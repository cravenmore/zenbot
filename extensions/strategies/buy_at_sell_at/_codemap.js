module.exports = {
  _ns: 'zenbot',

    'strategies.buy_at_sell_at': require('./strategy'),
    'strategies.list[]': '#strategies.buy_at_sell_at'

}
