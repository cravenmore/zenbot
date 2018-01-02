//Ported from https://github.com/pushkarnagle/gekko-buyatsellat
var z = require('zero-fill')
  , n = require('numbro')
var previousAction = 'sell';
var previousActionPrice = Infinity;

module.exports = function container (get, set, clear) {
  return {
    name: 'buy_at_sell_at',
    description: 'Simple strategy that buys and sells at predefined percentages with built in stop-loss and market-up rebuying functionality.',

    getOptions: function () {
      this.option('period', 'period length, same as --periodLength', String, '2m')
      this.option('periodLength', 'period length, same as --period', String, '2m')
      this.option('min_periods', 'min. number of history periods', Number, 30)
      this.option('buyat', 'Buy when the price surges to x% of the bought price or current balance on initial start (e.g. 1.15 for 15%).', Number, '1.05')
      this.option('sellat', 'Buy again if the price goes down to u% (0.97 for 3%) of the sold price.', Number, '0.97')
      this.option('stop_loss_pct', 'Sell when the price drops below y% (0.95 for 5%) of the bought price.', Number, '0.95')
      this.option('sellat_up', 'Buy again if the price surges to z% (1.01 for 1%) of last sold price.', Number, '1.01')
    },

    calculate: function (s) {
      //console.log(s);
    },

    onPeriod: function (s, cb) {
    if (!s.in_preroll) {
        if(previousAction === "buy") {
          // calculate the minimum price in order to sell
          const threshold = previousActionPrice * s.options.buyat;

          // calculate the stop loss price in order to sell
          const stop_loss = previousActionPrice * s.options.stop_loss_pct;

          // we sell if the price is more than the required threshold or equals stop loss threshold
          if((s.period.close > threshold) || (s.period.close < s.options.stop_loss)) {
            s.signal = 'sell'
            previousAction = 'sell';
            previousActionPrice = s.period.close;
          }
        }

        else if(previousAction === "sell") {
        // calculate the minimum price in order to buy
          const threshold = previousActionPrice * s.options.sellat;

        // calculate the price at which we should buy again if market goes up
          const sellat_up_price = previousActionPrice * s.options.sellat_up;

          // we buy if the price is less than the required threshold or greater than Market Up threshold
          if((s.period.close < threshold) || (s.period.close > sellat_up_price)) {
            s.signal = 'buy'
            previousAction = 'buy';
            previousActionPrice = s.period.close;
          }
        }
      }
      cb()
    },

    onReport: function (s) {
      var cols = []
      return cols
    }
  }
}
