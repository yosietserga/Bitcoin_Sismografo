const App = require('../startup');

const Configstore = require('configstore'); // config store management
const moment = require('moment');
const Huobi = require('node-huobi-api'); // the core

App.load('functions', 'common');
const common = App.functions.common;
const { log, isset, empty, getFloat } = common;

const DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36"
}

const config = new Configstore('huobiBotTrader');
const botTrader = {};
const __cData = {};
const pLast = {};

const defaults = {
    interval: 3,
    volumeOcurrences: 1,
    percentToWatch: 1,
    percentProfit: 0.3,
    percentStopLoss: 1,
    filters: {
        only_btc: true,
        only_usdt: false
    }
};

const getNewB = (APIKEY, APISECRET, account_id) => {

    return Huobi().options({
        APIKEY,
        APISECRET,
        account_id,
        useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
        recvWindow: 60000, // Set a higher recvWindow to increase response timeout
        verbose: true, // loogging everything
        log: function (...args) {
            common.log(Array.prototype.slice.call(args), 'info', 1);
        }
    });
};

let b;

async function init(options) {
    let o;

    if (!empty(options) && typeof options === 'object') {
        o = Object.assign({}, defaults, options);
    } else {
        o = Object.assign({}, defaults);
    }
    if (!isset(o.api.key) || empty(o.api.key) || !isset(o.api.secret) || empty(o.api.secret)) {
        return null;
    } else {
        if (!isset(o.api.account_id) || empty(o.api.account_id)) o.api.account_id = 0;
        config.set(o);
        b = getNewB(o.api.key, o.api.secret, o.api.account_id);

        return b;
    }
}

function getSymbols() {
	return Object.keys(__cData);
}

function getExchanger() {
    return b ? b : this;
}

async function candlesticks(code, period, cb) {
    return await b.candlesticks(code, period, cb);
}

function getTrades( code, cb ) {
    if (!isset(__cData[code].trades) || !isset(__cData[code].trades)) return [];
    if (typeof cb != 'function') cb = null;
    b.trades(code, function(e,d,s) {
        if (cb) cb(d.data, e);
    }, {size:100});
}

function getExchangeInfo(code) {
    if (isset(__cData.currencies) && isset(__cData.currencies[code]) && isset(__cData.currencies[code].exchangeInfo)) {
        return __cData.currencies[code].exchangeInfo;
    } else {
        if (!isset(__cData.currencies)) __cData.currencies = {};

        return new Promise((resolve, reject) => {
            b.exchangeInfo((error, res) => {
                if (res.data && Array.isArray(res.data)) {
                    for (let obj of res.data) {
                        if (currencyFilter(obj.symbol)) {
                            if (!isset(__cData.currencies[obj.symbol])) __cData.currencies[obj.symbol] = {};
                            /*
                            obj = {
                                'base-currency': 'smt',
                                'quote-currency': 'usdt',
                                'price-precision': 6,
                                'amount-precision': 4,
                                'symbol-partition': 'innovation',
                                symbol: 'smtusdt',
                                state: 'online',
                                'value-precision': 8,
                                'min-order-amt': 1,
                                'max-order-amt': 15000000,
                                'min-order-value': 5
                             }
                             */
                            __cData.currencies[obj.symbol].exchangeInfo = obj;
                        }
                    }

                    if (error) {
                        reject(error.body);
                    } else {
                        if (code) {
                            resolve(__cData.currencies[code].exchangeInfo);
                        } else {
                            resolve(__cData.currencies);
                        }
                    }
                }
            });
        });
    }
}

function currencyFilter(code) {
    let filters = config.get('filters');

    code = code.toUpperCase();

    if (!isset(filters) || empty(filters)) return false;

    if (isset(filters.only_btc) && filters.only_btc) {
        if (!code.find('BTC')) return false;
        if ((!isset(filters.only_usdt) || !filters.only_usdt) && code.find('BTCUSDT')) return false;
        if (code.find('BTCPAX')) return false;
    }

    if (isset(filters.only_usdt) && filters.only_usdt) {
        if (!code.find('USDT')) return false;
        if (code.find('USDTBTC')) return false;
        if (code.find('USDTETH')) return false;
    }

    return true;
}

function get24hData(code, cb) {
    var c = [];

    if (isset(code) && !empty(code)) {
        if (!Array.isArray(c)) c.push(code);
        else c = code;
    } else {
        c = false;
    }
    return new Promise((resolve, reject) => {

        b.bookTickers((error, res) => {
            
            if (error) {
                reject(error);
            } else {
                let __currencies = [];
                if (res && Array.isArray(res)) {
                    for (let obj of res) {
                        if (currencyFilter(obj.symbol)) {
                            //log(obj);
                            //log(__translateData( obj ));

                            /*
                            {
                              symbol: 'egtusdt',
                              open: 0.000957,
                              high: 0.001199,
                              low: 0.000955,
                              close: 0.001119,
                              amount: 453481419.1061988,
                              vol: 457456.8542729126,
                              count: 8760,
                              bid: 0.001115,
                              bidSize: 396180.79,
                              ask: 0.001119,
                              askSize: 251406.37
                            }
                             */
                            __currencies.push( __translateData( obj ));

                            if (typeof cb === 'function') {
                                cb(__translateData( obj ));
                            }

                        }
                    }
                }

                resolve(__currencies);
            }
        });
    });
}

function __translateData(input) {
    let output =  {};

                            /*
                            {
                              symbol: 'egtusdt',
                              open: 0.000957,
                              high: 0.001199,
                              low: 0.000955,
                              close: 0.001119,
                              amount: 453481419.1061988,
                              vol: 457456.8542729126,
                              count: 8760,
                              bid: 0.001115,
                              bidSize: 396180.79,
                              ask: 0.001119,
                              askSize: 251406.37
                            }
                             */
    output.symbol = input.symbol;
    output.bestBid = input.bid;
    output.bestBidQty = input.bidSize;
    output.bestAsk = input.ask;
    output.bestAskQty = input.askSize;
    output.quoteVolume = input.vol;
    output.volume = input.amount;
    output.open = input.open;
    output.close = input.close;
    output.high = input.high;
    output.low = input.low;
    output.numTrades = input.count;
    output.openTime = null;
    output.closeTime = null;
    output.closeQty = null;
    output.averagePrice = null;
    output.prevClose = null;

    return output;
}
function getCandlestickData(code, cb) {
    if (!isset(code) || empty(code)) return;

    var c = [];

    if (!Array.isArray(c)) c.push(code);
    else c = code;

    return new Promise(resolve => {
        b.websockets.candlesticks(c, "1m", r => {
            if (typeof cb == 'function') {
                cb(r);
            }
        });
    });
}

function getMarket( code ) {
    return b.getMarket( code );
}









var HUOBI_PRO = {
    get_account: function() {
        var path = `/v1/account/accounts`;
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    get_balance: function() {
        var account_id = config.huobi.account_id_pro;
        var path = `/v1/account/accounts/${account_id}/balance`;
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    get_open_orders: function(symbol) {
        var path = `/v1/order/orders`;
        var body = get_body();
        body.symbol = symbol;
        body.states = 'submitted,partial-filled';
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    get_order: function(order_id) {
        var path = `/v1/order/orders/${order_id}`;
        var body = get_body();
        var payload = sign_sha('GET', HOST, path, body);
        return call_api('GET', path, payload, body);
    },
    buy_limit: function(symbol, amount, price) {
        var path = '/v1/order/orders/place';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        body["account-id"] = config.huobi.account_id_pro;
        body.type = "buy-limit";
        body.amount = amount;
        body.symbol = symbol;
        body.price = price;

        return call_api('POST', path, payload, body);
    },
    sell_limit: function(symbol, amount, price) {
        var path = '/v1/order/orders/place';
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        body["account-id"] = config.huobi.account_id_pro;
        body.type = "sell-limit";
        body.amount = amount;
        body.symbol = symbol;
        body.price = price;

        return call_api('POST', path, payload, body);
    },
    withdrawal: function(address, coin, amount, payment_id) {
        var path = `/v1/dw/withdraw/api/create`;
        var body = get_body();
        var payload = sign_sha('POST', HOST, path, body);

        body.address = address;
        body.amount = amount;
        body.currency = coin;
        if (coin.toLowerCase() == 'xrp') {
            if (payment_id) {
                body['addr-tag'] = payment_id;
            } else {
                console.log('huobi withdrawal', coin, 'no payment id provided, cancel withdrawal');
                return Promise.resolve(null);
            }
        }

        return call_api('POST', path, payload, body);
    }
}

function addChange(data) {
    if (myData.get('debug')) log('Adding data change historic');
    if (!data || typeof data.code == 'undefined') return;
    let code = data.code;
    if (!currencyFilter( code )) return;
    let hash = Math.abs(`${data.volume}:${data.close}`.hash());
    //check if really changed
    //update price n volume for quick access
    //trigger onchange event
    if (myData.get('debug')) log('Setting vars to save changes');
    __cData.changes = __cData.changes || {};
    __cData.changes[data.code] = __cData.changes[data.code] || {};

    __cData[data.code] = __cData[data.code] || {};
    __cData[data.code].changes = __cData[data.code].changes || {};

    if ((isset(__cData[data.code].hash) && __cData[data.code].hash != hash) || !isset(__cData[data.code].hash)) {
        //TODO:trigger event beforeChange passing data as parameter
        //if return after call event, then return and leave the rest like that

        if (!__cData.changes[data.code].first) {
            __cData.changes[data.code].first = data;
            __cData[data.code].changes.first = data;
        }

        let pricePrecision = 8;
        /*
        //update current price and volume
        if (isset( __cData.currencies[code].exchangeInfo['price-precision'] ))
            pricePrecision = __cData.currencies[code].exchangeInfo['price-precision'];
        else if (isset( __cData.currencies[code].exchangeInfo['quote-currency'] )) {
            if (__cData.currencies[code].exchangeInfo['quote-currency'] === 'btc') pricePrecision = 8;
            if (__cData.currencies[code].exchangeInfo['quote-currency'] === 'usdt') pricePrecision = 6;
        }
        */

        __cData[data.code].price = data.close;
        __cData[data.code].volume = getFloat(data.amount * data.close).toFixed( pricePrecision ); //24h turn over is in base currency, but the amount is in crypto currency
        //__cData[data.code].volume = data.vol; //24h turn over is in base currency, but the amount is in crypto currency

        //update hash token
        __cData[data.code].hash = hash;
        if (!isset(__cData[data.code].candlesticks)) __cData[data.code].candlesticks = {};
        if (!isset(__cData[data.code].orders)) __cData[data.code].orders = {};
        if (!isset(__cData[data.code].depth)) __cData[data.code].depth = {};
        if (!isset(__cData[data.code].trades)) __cData[data.code].trades = {};
        if (!isset(__cData[data.code].balances)) __cData[data.code].balances = {};

        __cData.changes[data.code].current = __cData.changes[data.code].current || {};
        __cData.changes[data.code].historic = __cData.changes[data.code].historic || {};

        __cData[data.code].changes.current = __cData.changes[data.code].current || {};
        __cData[data.code].changes.historic = __cData.changes[data.code].historic || {};

        //last current, is now the previous one
        __cData.changes[data.code].prev = __cData.changes[data.code].current;
        __cData[data.code].changes.prev = __cData.changes[data.code].current;

        //set current data to current prop
        __cData.changes[data.code].current = data;
        __cData[data.code].changes.current = data;

        //fill props for consistency
        __cData.changes[data.code].current.volumeDiff = 0;
        __cData.changes[data.code].current.volumeDiffProgressive = 0;

        __cData[data.code].changes.current.volumeDiff = 0;
        __cData[data.code].changes.current.volumeDiffProgressive = 0;
        
        data.percentChange =((1 - (data.bidPrice / __cData.changes[data.code].first.bidPrice)) * 100).toFixed(4);

        __cData[data.code].changes.current.percentChange = __cData.changes[data.code].current.percentChange = data.percentChange;
        //update previous props with changes differences
        __cData.changes[data.code].prev.percentDiff = data.percentChange;
        __cData.changes[data.code].prev.percentDiffProgressive = data.percentChange - __cData.changes[data.code].prev.percentChange;

        __cData[data.code].changes.prev.percentDiff = data.percentChange;
        __cData[data.code].changes.prev.percentDiffProgressive = data.percentChange - __cData.changes[data.code].prev.percentChange;

        if (__cData.changes[data.code].prev.volume) {
            vDiff = data.volume - __cData.changes[data.code].first.volume;
            vDiffP = vDiff / data.volume * 100;
            __cData.changes[data.code].current.volumeDiff = getFloat(vDiffP.toFixed(4));
            __cData[data.code].changes.current.volumeDiff = getFloat(vDiffP.toFixed(4));


            vDiff = data.volume - __cData.changes[data.code].prev.volume;
            vDiffP = vDiff / data.volume * 100;
            __cData.changes[data.code].current.volumeDiffProgressive = getFloat(vDiffP.toFixed(6));
            __cData[data.code].changes.current.volumeDiffProgressive = getFloat(vDiffP.toFixed(6));
        }

        __cData.changes[data.code].historic[data.id] = __cData.changes[data.code].current;
        __cData[data.code].changes.historic[data.id] = __cData.changes[data.code].current;

        //TODO:trigger event changed passing data as parameter
        //if return after call event, then return and leave the rest like that
    }
}

function getDepthChange(code) {
    if (typeof code == 'undefined') return;

    __cData[code] = __cData[code] || {};
    __cData[code].ob = __cData[code].ob || {};

    return __cData[code].ob;
}

function getActualChange(code) {
    if (!__cData || !code || !__cData[code]) return;
    return __cData.changes[code].current;
}

function getFirstChange(code) {
    if (!__cData || !code || !__cData[code]) return;
    return __cData.changes[code].first;
}

function getLastChange(code) {
    if (!__cData || !code || !__cData[code]) return;
    return __cData.changes[code].prev;
}

function getChange(code, id) {
    if (!__cData || !code || !id || !__cData[code]) return;
    return __cData.changes[code].historic[id];
}

function getChanges(code) {
    if (!__cData) return;
    if (!code) return __cData.changes;
    if (code) return __cData.changes[code].historic;
}

function getAVGChanges(code) {
    if (!__cData || !code || !__cData.changes[code].historic || Object.keys(pLast).length === 0) return;

    var h = __cData.changes[code].historic;

    var sumPriceBuy = 0,
        sumPriceSell = 0,
        sumPercentDiff = 0,
        sumVolumeDiff = 0,
        sumVolumeDiffProgressive = 0,
        counter = 0;

    for (var k in h) {
        var item = h[k];

        sumPriceBuy = (sumPriceBuy + item.priceBuy * 1);
        sumPriceSell = (sumPriceSell + item.priceSell * 1);
        sumPercentDiff = (sumPercentDiff + item.percentDiff * 1);
        sumVolumeDiff = (sumVolumeDiff + item.volumeDiff * 1);
        sumVolumeDiffProgressive = sumVolumeDiffProgressive * 1 + item.volumeDiffProgressive * 1;
        counter++;
    }

    var avgPriceBuy = sumPriceBuy / counter;
    var avgPriceSell = sumPriceSell / counter;
    var avgPercentDiff = sumPercentDiff / counter;
    var avgVolumeDiff = sumVolumeDiff / counter;
    var avgVolumeDiffProgressive = (sumVolumeDiffProgressive * 1) / counter;

    return {
        avgPriceBuy: avgPriceBuy,
        avgPriceSell: avgPriceSell,
        avgPercentDiff: avgPercentDiff,
        avgVolumeDiff: avgVolumeDiff,
        avgVolumeDiffProgressive: (avgVolumeDiffProgressive * 1).toFixed(6),

        sumPriceBuy: sumPriceBuy,
        sumPriceSell: sumPriceSell,
        sumPercentDiff: sumPercentDiff,
        sumVolumeDiff: sumVolumeDiff,
        sumVolumeDiffProgressive: (sumVolumeDiffProgressive * 1).toFixed(6),

        counter: counter
    };
}

function getData(symbol, key) {
    if (!empty(symbol) && !empty(key))
        return  isset(__cData[symbol]) && isset(__cData[symbol][key]) ? __cData[symbol][key] : null;
    else if (empty(symbol) && !empty(key))
        return  isset(__cData[key]) ? __cData[key] : null;
    else if (!empty(symbol) && empty(key))
        return isset(__cData[symbol]) ? __cData[symbol] : null;
    else
        return __cData;
}

module.exports = {
    init,
    config,

    getExchanger,
    getData,
    get24hData,
    getExchangeInfo,
    addChange,
    getDepthChange,
    getActualChange,
    getFirstChange,
    getLastChange,
    getChange,
    getChanges,
    getAVGChanges,
    getTrades,
    candlesticks,
};
