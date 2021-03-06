let z = require('zero-fill')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'multi_ema',
    description: 'Buy when (EMA - last(EMA) > 0) and sell when (EMA - last(EMA) < 0).',

    getOptions: function (s) {
      this.option('period', 'period length, same as --period_length', String, '2m')
      this.option('periodLength', 'period length, same as --period', String, '2m')
      this.option('ema_type_weak', 'type of calculation method for weak trend EMA', String, 'ema')
      this.option('ema_type_strong', 'type of calculation method for strong trend EMA', String, 'ema')
      this.option('ema_periods_weak', 'number of periods for weak trend EMA', Number, 26)
      this.option('ema_periods_strong', 'number of periods for strong trend EMA', Number, 26)
      this.option('neutral_rate_weak', 'avoid trades if abs(trend_ema_weak) under this float (0 to disable, "auto" for a variable filter)', String, 'auto')
      this.option('neutral_rate_strong', 'avoid trades if abs(trend_ema_strong) under this float (0 to disable, "auto" for a variable filter)', String, 'auto')
      this.option('neutral_rate_min_weak', 'avoid trades if neutral_rate_weak under this float', Number, 0)
      this.option('neutral_rate_min_strong', 'avoid trades if neutral_rate_strong under this float', Number, 0)
      this.option('order_type_weak', 'order type for orders based on weak signal', String)
      this.option('order_type_strong', 'order type for orders based on strong signal', String)
      this.option('decision', 'control decision mode', String, 'direct')

      // get order type
      if (!s.options.order_type_weak) {
        s.options.order_type_weak = s.options.order_type
      }
      if (!s.options.order_type_strong) {
        s.options.order_type_strong = s.options.order_type
      }
    },

    calculate: function (s) {
    },

    calculateEma: function (s, type) {
      let trend_name = 'trend_ema_' + type,
        rate_name = 'trend_ema_rate_' + type,
        stddev_name = 'trend_ema_stddev_' + type,
        periods_name = 'ema_periods_' + type,
        neutral_name = 'neutral_rate_' + type

      get('lib.' + s.options['ema_type_' + type])(s, trend_name, s.options[periods_name])

      if (s.period[trend_name] && s.lookback[0] && s.lookback[0][trend_name]) {
        s.period[rate_name] = (s.period[trend_name] - s.lookback[0][trend_name]) / s.lookback[0][trend_name] * 100
      }
      if (s.options[neutral_name] === 'auto') {
        get('lib.stddev')(s, stddev_name, 10, rate_name)
      }
      else if (s.options[neutral_name] === 'auto_trend') {
        get('lib.stddev')(s, stddev_name, s.options[periods_name], rate_name)
      }
      else if (s.options[neutral_name] === 'auto_new') {
        let trend_ema
        if (s.lookback[0] && s.lookback[0][trend_name]) {
          trend_ema = s.lookback[0][trend_name]
        } else {
          trend_ema = s.period[trend_name]
          s.period[stddev_name] = s.period[trend_name] / s.options[periods_name]
        }
        while (trend_ema > 1) {
          trend_ema = trend_ema / 10
        }
        s.period[stddev_name] = trend_ema / s.options[periods_name]
      }
      else {
        s.period[stddev_name] = s.options[neutral_name]
      }
    },

    onPeriod: function (s, cb) {
      s.strategy.calculateEma(s, 'weak')
      s.strategy.calculateEma(s, 'strong')

      s.period.trend = null

      if ((typeof s.period.trend_ema_stddev_weak === 'number') && (typeof s.period.trend_ema_stddev_strong === 'number')) {

        let ema_weak = Math.max(s.period.trend_ema_stddev_weak, s.options.neutral_rate_min_weak)
        let ema_strong = Math.max(s.period.trend_ema_stddev_strong, s.options.neutral_rate_min_strong)

        if (s.period.trend_ema_rate_strong >= ema_strong) {
          s.period.trend = 'up_strong'
        }
        else if (s.period.trend_ema_rate_strong <= (ema_strong * -1)) {
          s.period.trend = 'down_strong'
        }
        else if (s.period.trend_ema_rate_weak >= ema_weak) {
          s.period.trend = 'up_weak'
        }
        else if (s.period.trend_ema_rate_weak <= (ema_weak * -1)) {
          s.period.trend = 'down_weak'
        }
      }

      let signal = s.strategy.getSignal(s, true)

      if (signal === 'buy' && s.my_trades.length && s.my_trades[s.my_trades.length - 1].type === signal) {
        // avoid multiple buy signals
        signal = null
      }
        
      s.signal = signal
      cb()
    },

    onReport: function (s) {
      let cols = []

      if ((typeof s.period.trend_ema_rate_weak === 'number' && typeof s.period.trend_ema_stddev_weak === 'number') ||
        (typeof s.period.trend_ema_rate_strong === 'number' && typeof s.period.trend_ema_stddev_strong === 'number')) {
        let signal = s.strategy.getSignal(s, false)
        let color = 'grey'
        if (signal === 'buy') {
          color = 'green'
        } else if (signal === 'sell') {
          color = 'red'
        }
        if (typeof s.period.trend_ema_rate_weak === 'number' && typeof s.period.trend_ema_stddev_weak === 'number') {
          cols.push(z(8, n(s.period.trend_ema_rate_weak).format('0.0000'), ' ')[color])
          cols.push(z(8, n(s.period.trend_ema_stddev_weak).format('0.0000'), ' ').grey)
        } else  {
          cols.push('                  ')
        }
        if (typeof s.period.trend_ema_rate_strong === 'number' && typeof s.period.trend_ema_stddev_strong === 'number') {
          cols.push(z(8, n(s.period.trend_ema_rate_strong).format('0.0000'), ' ')[color])
          cols.push(z(8, n(s.period.trend_ema_stddev_strong).format('0.0000'), ' ').grey)
        } else {
          cols.push('                  ')
        }
        let sign = '  |  '
        color = 'grey'
        if (s.period.trend === 'down_strong') {
          sign = '<<|  '
          color = 'red'
        } else if (s.period.trend === 'down_weak') {
          sign = ' <|  '
          color = 'red'
        } else if (s.period.trend === 'up_weak') {
          sign = '  |> '
          color = 'green'
        } else if (s.period.trend === 'up_strong') {
          sign = '  |>>'
          color = 'green'
        }
        cols.push(z(7, sign, ' ')[color])
      } else {
        cols.push('                                           ')
      }

      return cols
    },

    getSignal: function (s, remember) {
      let signal = null
      let type = null

      if (s.lookback[0]) {
        let trend1 = s.lookback[0].trend
        let trend2 = s.period.trend

        if (s.options.decision === 'direct') {
          if (trend2 === 'up_strong' || trend2 === 'down_weak') {
            signal = 'sell'
          } else if (trend2 === 'down_strong' || trend2 === 'up_weak') {
            signal = 'buy'
          }
          if (trend2 === 'up_strong' || trend2 === 'down_strong') {
            type = 'strong'
          } else if (trend2 === 'down_weak' || trend2 === 'down_weak') {
            type = 'weak'
          }

        } else if (s.options.decision === 'direct-remember') {
          if (trend2 === 'up_strong') {
            if (remember) {
              s.sold_after_drop = true
              s.bought_after_rise = false
            }
            signal = 'sell'
            type = 'strong'
          } else if (trend2 === 'down_strong') {
            if (remember) {
              s.bought_after_rise = true
              s.sold_after_drop = false
            }
            signal = 'buy'
            type = 'strong'
          } else if (trend2 === 'up_weak' && !s.sold_after_drop) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'buy'
            type = 'weak'
          } else if (trend2 === 'down_weak' && !s.bought_after_rise) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'sell'
            type = 'weak'
          } else if (trend2 === null) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
          }

        } else if (s.options.decision === 'after') {
          if (trend1 === 'up_strong' && trend2 !== 'up_strong') {
            signal = 'sell'
            type = 'strong'
          } else if (trend1 === 'down_strong' && trend2 !== 'down_strong') {
            signal = 'buy'
            type = 'strong'
          } else if (trend2 === 'up_weak' || trend2 === 'up_strong') {
            signal = 'buy'
            if (trend2 === 'up_strong') {
              type = 'strong'
            } else if (trend2 === 'up_weak') {
              type = 'weak'
            }
          } else if (trend2 === 'down_weak' || trend2 === 'down_strong') {
            signal = 'sell'
            if (trend2 === 'up_strong') {
              type = 'strong'
            } else if (trend2 === 'up_weak') {
              type = 'weak'
            }
          }

        } else if (s.options.decision === 'after-remember') {
          if (trend1 === 'up_strong' && trend2 !== 'up_strong') {
            if (remember) {
              s.sold_after_drop = true
              s.bought_after_rise = false
            }
            signal = 'sell'
            type = 'strong'
          } else if (trend1 === 'down_strong' && trend2 !== 'down_strong') {
            if (remember) {
              s.bought_after_rise = true
              s.sold_after_drop = false
            }
            signal = 'buy'
            type = 'strong'
          } else if ((trend2 === 'up_weak' && !s.sold_after_drop) || trend2 === 'up_strong') {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'buy'
            if (trend2 === 'up_strong') {
              type = 'strong'
            } else if (trend2 === 'up_weak') {
              type = 'weak'
            }
          } else if ((trend2 === 'down_weak' && !s.bought_after_rise) || trend2 === 'down_strong') {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'sell'
            if (trend2 === 'down_strong') {
              type = 'strong'
            } else if (trend2 === 'down_weak') {
              type = 'weak'
            }
          } else if (trend2 === null) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
          }
        }

        if (signal !== null) {
          if (type === 'weak') {
            s.options.order_type = s.options.order_type_weak
          } else if (type === 'strong') {
            s.options.order_type = s.options.order_type_strong
          }
        }
      }

      return signal
    }
  }
}
