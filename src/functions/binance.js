const App = require('../startup');

const moment = require('moment'); // time manipulation
const Binance = require('node-binance-api'); // the core
const Configstore = require('configstore'); // config store management

App.load('functions', 'common');
const common = App.functions.common;
const { log, isset, empty, getFloat } = common;

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

const config = new Configstore('binanceBotTrader');
const botTrader = {};
const __cData = {};
const pLast = {};
//const data = {};

const getNewB = (key, secret) => {
    return Binance().options({
        APIKEY: key,
        APISECRET: secret,
        useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
        recvWindow: 60000, // Set a higher recvWindow to increase response timeout
        test: false, // If you want to use sandbox mode where orders are simulated
        verbose: false, // loogging everything
        log: function (...args) {
            common.log(Array.prototype.slice.call(args), 'info', 2);
        }
    });
};

let b;

function getSymbols() {
	return Object.keys(__cData);
}

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
        config.set(o);
        b = getNewB(o.api.key, o.api.secret);

        //load cryptos list, prices and balances
        await Promise.all([
            //init cryptos or currencies data vars
            await getCurrencyList(),

            //get initial prices 
            await getExPrices(),

            //load balances    
            await loadBalances(handleBalances),

            //load opened orders    
            await loadOrders( 'open', false, handleOrders ),
        ]);

        return b;
    }
}

function getExchanger() {
    return b ? b : this;
}

function currencyFilter(code) {
    let filters = config.get('filters');

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
        if (code.find('USDTBNB')) return false;
    }

    return true;
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

function get24hData(code, cb) {
    var c = [];

    if (isset(code) && !empty(code)) {
        if (!Array.isArray(c)) c.push(code);
        else c = code;
    } else {
        c = false;
    }

    return new Promise((resolve, reject) => {
        b.websockets.prevDay(c, (error, res) => {
            if (error) {
                reject(error);
            } else {
                if (typeof cb === 'function') {
                    cb(res);
                } 
                /* response json
                {
                    eventType: '24hrTicker',
                    eventTime: 1544672686875,
                    symbol: 'IOTAUSDT',
                    priceChange: '0.00510000',
                    percentChange: '2.314',
                    averagePrice: '0.22694785',
                    prevClose: '0.22050000',
                    close: '0.22550000',
                    closeQty: '554.70000000',
                    bestBid: '0.22540000',
                    bestBidQty: '1000.00000000',
                    bestAsk: '0.22610000',
                    bestAskQty: '642.43000000',
                    open: '0.22040000',
                    high: '0.23400000',
                    low: '0.21810000',
                    volume: '1727698.94000000',
                    quoteVolume: '392097.56464400',
                    openTime: 1544586286879,
                    closeTime: 1544672686879,
                    firstTradeId: 3276511,
                    lastTradeId: 3279856,
                    numTrades: 3346
                }
                */
                resolve(res);
            }
        });
    });
}

function getDepthData(code, cb) {
    if (!isset(code) || empty(code)) return;

    var c = [];

    if (!Array.isArray(c)) c.push(code);
    else c = code;

    return new Promise((resolve, reject) => {
        b.websockets.depth(c, (res) => {
            try {
                if (typeof cb == 'function') {
                    cb(res);
                }
                /* response json
                {
                    e: 'depthUpdate',
                    E: 1544121579630,
                    s: 'BNBBTC',
                    U: 147051094,
                    u: 147051111,
                    b: [
                        ['0.00137730', '0.87000000', []],
                        ['0.00137720', '31.54000000', []],
                        ['0.00137710', '239.94000000', []],
                        ['0.00137550', '53.50000000', []],
                        ['0.00137340', '0.00000000', []],
                        ['0.00137310', '229.87000000', []],
                        ['0.00137190', '2.00000000', []]
                    ],
                    a: [
                        ['0.00137880', '1.63000000', []],
                        ['0.00137890', '226.77000000', []],
                        ['0.00137900', '73.23000000', []],
                        ['0.00137990', '202.00000000', []],
                        ['0.00138080', '0.00000000', []],
                        ['0.00153230', '29.55000000', []]
                    ]
                }
                */
                resolve(res);
            } catch (error) {
                reject(error);
            }
        });
    });
}

function getDepthCacheData(code, cb) {
    if (!isset(code) || empty(code)) return;

    var c = [];

    if (!Array.isArray(code)) c.push(code);
    else c = code;

    return new Promise((resolve, reject) => {
        b.websockets.depthCache(c, (symbol, res) => {
            try {
                if (typeof cb == 'function') {
                    cb(symbol, res);
                }
                /* response json
                {
                    lastUpdateId: 147059405,
                    bids: {
                        '0.00137710': 0.87,
                        '0.00137700': 1.19,
                        '0.00137640': 31.56,
                        '0.00137630': 531.87,
                        '0.00137510': 25.25,
                        '0.00137500': 60.28
                    },
                    asks: {
                        '0.00137710': 0.87,
                        '0.00137700': 1.19,
                        '0.00137640': 31.56,
                        '0.00137630': 531.87,
                        '0.00137510': 25.25,
                        '0.00137500': 60.28
                    }
                }
                */
                resolve(symbol, res);
            } catch (error) {
                reject(error);
            }
        });
    });
}

function getTickersData(code) {
    var c = [];

    if (!Array.isArray(c)) c.push(code);
    else c = code;

    return new Promise((resolve, reject) => {
        b.bookTickers((error, res) => {
            if (error) {
                reject(error);
            } else {
                /* response json
                [
                    {
                        symbol: 'ETHBTC',
                        bidPrice: '0.02643800',
                        bidQty: '0.98000000',
                        askPrice: '0.02645400',
                        askQty: '1.90000000'
                    },
                    {
                        symbol: 'LTCBTC',
                        bidPrice: '0.00766500',
                        bidQty: '0.20000000',
                        askPrice: '0.00767900',
                        askQty: '104.10000000'
                    },
                    ...
                ]
                */
                resolve(res);
            }
        });
    });
}

function terminateSubscriptions() {
    let endpoints = b.websockets.subscriptions();
    for ( let endpoint in endpoints ) {
        log("... Terminating websocket: "+endpoint);
        endpoints[endpoint].terminate();
    }
}

function getTradesData(code, cb) {
    if (!isset(code) || empty(code)) return;

    var c = [];

    if (!Array.isArray(code)) c.push(code);
    else c = code;

    return new Promise((resolve, reject) => {
        b.websockets.trades(c, res => {
            try {
                if (typeof cb == 'function') {
                    cb(res);
                }
                /* response json
                {
                    e: "trade", // Event type
                    E: 123456789, // Event time
                    s: "BNBBTC", // Symbol
                    t: 12345, // Trade ID
                    p: "0.001", // Price
                    q: "100", // Quantity
                    b: 92698692, // Buyer order ID
                    a: 92698687, // Seller order ID
                    T: 123456785, // Trade time
                    m: true, // Is the buyer the market maker?
                    M: true // Ignore
                }
                */
                resolve(res);
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function getExPrices( code ) {
    if (isset(code) && !empty(code)) {
        return await new Promise((resolve, reject) => {
            b.prices(code, (error, res) => {
                try {
                    resolve(res);
                    return res;
                } catch (error) {
                    reject(error);
                }
            });
        });
    } else {
        return await new Promise((resolve, reject) => {
            b.prices((error, res) => {
                try {
                    resolve(res);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
}

function getPrices( code ) {
    if (isset(code) && !empty(code)) {
        if (isset(__cData.prices) && isset(__cData.prices[code]))
            return __cData.prices[code];
        else if (isset(__cData[code]) && isset(__cData[code].price))
            return __cData[code].price
        else return null;
    } else {
        return __cData.prices;
    }
}

function addChange(data) {
    if (!data || typeof data.code == 'undefined') return;

    let hash = Math.abs(`${data.volume}:${data.close}`.hash());
    //check if really changed
    //update price n volume for quick access 
    //trigger onchange event 

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

        //update current price and volume 
        __cData[data.code].price = data.close;
        __cData[data.code].volume = data.quoteVolume;

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

        //update previous props with changes differences
        __cData.changes[data.code].prev.percentDiff = data.percentChange - __cData.changes[data.code].first.percentChange;
        __cData.changes[data.code].prev.percentDiffProgressive = data.percentChange - __cData.changes[data.code].prev.percentChange;

        __cData[data.code].changes.prev.percentDiff = data.percentChange - __cData.changes[data.code].first.percentChange;
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

function addDepthChange(code, data) {
    if (!data || typeof code == 'undefined') return;

    __cData[code] = __cData[code] || {};
    __cData[code].ob = __cData[code].ob || {};

    __cData[code].ob.bids = __cData[code].ob.bids || {};
    __cData[code].ob.asks = __cData[code].ob.asks || {};

    if (!__cData[code].ob.first) {
        __cData[code].ob.first = {};
        __cData[code].ob.first.bids = data.bids.data;
        __cData[code].ob.first.asks = data.asks.data;
    }

    const getChanges = (type, orders) =>  {
        for (i in orders) {
            let price = i;
            let volume = orders[i];

            if (!isset(__cData[code].ob.first[type][price])) {
                __cData[code].ob[type][price] = 0;
            } else {
                let vDiff = volume - __cData[code].ob.first[type][price];
                let vDiffP = vDiff / volume * 100;
                __cData[code].ob[type][price] = getFloat(vDiffP.toFixed(4));
            }
            /*
            if (isset(__cData[code].ob[type])) {
                Object.keys(__cData[code].ob[type])
                    .filter( k => !Object.keys(orders).includes( k ))
                    .map( (v, k) => __cData[code].ob[type][k] = -100 );
            }
            */
        }
    }

    getChanges('bids', data.bids.data);
    getChanges('asks', data.asks.data);
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

async function getCurrencyList() {
    if (!isset(__cData)) return null;

    try {
        __cData.currencies = __cData.currencies || {};
        __cData.prices = await getExPrices();
        if (empty(__cData.currencies)) {
            let cs = Object.entries(__cData.prices);
            for (let i = 0; cs.length > i; i++) {
                let currencyCode = cs[i][0];
                if (!currencyFilter(currencyCode)) continue;
                __cData.currencies[currencyCode] = {};
                __cData[currencyCode] = __cData[currencyCode] || {};
                __cData[currencyCode].price = cs[i][1];
            }
        }
        return __cData.currencies;
    } catch (error) {
        log(error);
    }
}

function thPriceDirection(code) {
    return thWhichIsBigger(code) == 'bids' ? 'down' : thWhichIsBigger(code) == 'asks' ? 'up' : null;
}

function thWhichIsBigger(code) {
    if (!isset(__cData[code].trades) || empty(__cData[code].trades)) return null;
    const { bids, asks } = __cData[code].trades;
    return (bids.volume > asks.volume) ? 'bids' : 'asks';
}

function obPriceDirection(code) {
    let side = obWhichIsBigger(code) == 'asks' ? 'down' : obWhichIsBigger(code) == 'bids' ? 'up' : null;
    /*
    //TODO: check if there is a big wall to reach the sell price
    const toReachPrice = (price, percent) => {
        let price;
        let toReachPrice = price * (1 + percent);
        let vol = 0;
        for (i in asks) {
            if (getFloat(i) < toReachPrice) {
                vol = vol + asks[i];
            } else {
                
            }
        }
        for (i in bids) {
            if (getFloat(i) < toReachPrice) {
                vol = vol + asks[i];
            } else {
                
            }
        }
    }
    */
    return side;
}

function obWhichIsBigger(code) {
    if (!isset(__cData[code]) || !isset(__cData[code].depth)) return null;
    const { bids, asks } = __cData[code].depth;
    return (bids.volume > asks.volume) ? 'bids' : 'asks';
}

function obGetRisk(code) {
    if (typeof __cData[code].order == 'undefined' || Object.keys(__cData[code].order).length === 0) return null;
    return __cData[code].order.risk || null;
}

function thSpeed(code) {
    if (!isset(__cData[code]) || !isset(__cData[code].trades) || empty(__cData[code].trades)) return { bids: {}, asks: {} };

    const { bids, asks } = __cData[code].trades;

    for (t in bids.trades) {
        __bids[t] = bids.trades[t].length;
    }

    for (t in asks.trades) {
        __asks[t] = asks.trades[t].length;
    }

    return {
        bids: __bids,
        asks: __asks
    };
}

function csTopPrice(code) {
    if (typeof __cData[code].candlesticks == 'undefined' || Object.keys(__cData[code].candlesticks).length === 0) return null;
    return __cData[code].candlesticks.top;
}

function csBottomPrice(code) {
    if (typeof __cData[code].candlesticks == 'undefined' || Object.keys(__cData[code].candlesticks).length === 0) return null;
    return __cData[code].candlesticks.bottom;
}

function predictPriceDirection(code) {
    const { bids, asks } = thSpeed(code);
    var resume = {},
        positiveResume = false;

	if (!isset(__cData[code])) return null;

    if (typeof __cData[code].candlesticks.resume != 'undefined') {
        resume = __cData[code].candlesticks.resume;
        if (typeof resume['in a few seconds'] != 'undefined' &&
            typeof resume['in a few seconds'].buyVolume != 'undefined' &&
            typeof resume['in a few seconds'].sellVolume != 'undefined' &&
            typeof resume['in a few seconds'].trades != 'undefined')
            positiveResume = (resume['in a few seconds'].buyVolume > resume['in a few seconds'].sellVolume && resume['in a few seconds'].trades > 50);
    }

    if (!obGetRisk(code) &&
        positiveResume &&
        obPriceDirection(code) == 'up' &&
        thPriceDirection(code) == 'up' &&
        asks['in a few seconds'] > 5 &&
        asks['a few seconds ago'] > 5) {
        return 'up';
    } else {
        return 'down';
    }
}

async function depth(codes, cb=null) {
    let lastBidsVol = 0;
    let lastAsksVol = 0;

    getDepthCacheData(codes, (symbol, res) => {
        if (!isset(__cData[symbol].depth) || !Array.isArray(__cData[symbol].depth)) __cData[symbol].depth = [];

        let bids = b.sortBids(res.bids, Object.keys(res.bids).length);
        let asks = b.sortAsks(res.asks, Object.keys(res.bids).length);

        let bidsVol = [];
        let asksVol = [];

        for (let i in bids) bidsVol.push(bids[i]);
        for (let i in asks) asksVol.push(asks[i]);

        let bVol = b.sum(bidsVol);
        let aVol = b.sum(asksVol);

        let bidsWalls = {};
        let asksWalls = {};

        let bidsMax = Object.keys(bids).sort(function (a, b) {
            return getFloat(bids[b]) - getFloat(bids[a])
        }).slice(0,5).sort(function (a, b) {
            return getFloat(b) - getFloat(a)
        });

        let asksMax = Object.keys(asks).sort(function (a, b) {
            return getFloat(asks[b]) - getFloat(asks[a])
        }).slice(0,5).sort(function (a, b) {
            return getFloat(a) - getFloat(b)
        });

        for (let price of bidsMax) bidsWalls[price] = getFloat(bids[price]);
        for (let price of asksMax) asksWalls[price] = getFloat(asks[price]);
        
        let bidsSize = lastBidsVol > bVol ? 'INCREASE' : 'DECREASE';
        let asksSize = lastAsksVol > aVol ? 'INCREASE' : 'DECREASE';

        lastBidsVol = bVol;
        lastAsksVol = aVol;

        let last = __cData[symbol].depth[__cData[symbol].depth.length - 1];
        
        if (empty(last) || (last.bids.volume != bVol || last.asks.volume != aVol)) {
            __cData[symbol].depth.push({
                symbol,
                lastUpdateId: res.lastUpdateId,
                time: moment().valueOf(),
                higher: (aVol >= bVol ? 'ASKS' : 'BIDS'),
                bids: {
                    data: bids,
                    volume: bVol,
                    size: bidsSize,
                    walls: bidsWalls,
                    first: getFloat(b.first(bids))
                },
                asks: {
                    data: asks,
                    volume: aVol,
                    size: asksSize,
                    walls: asksWalls,
                    first: getFloat(b.first(asks))
                }
            });
        }

        if (typeof cb == 'function') {
            cb( __cData[symbol].depth );
        }
    });
}

async function candlesticks(code, live = true) {
    const setCSArray = (item) => {
    	/*
    	item = { 
	    	t: 1562824140000,
			T: 1562824199999,
			s: 'LTCBTC',
			i: '1m',
			f: 31029736,
			L: 31029830,
			o: '0.00887300',
			c: '0.00887300',
			h: '0.00888900',
			l: '0.00886500',
			v: '217.27000000',
			n: 95,
			x: false,
			q: '1.92827315',
			V: '173.50000000',
			Q: '1.53957485',
			B: '0' 
		}
    	 */
    	let code = item.s;
    	
	    __cData[code] = __cData[code] || {};
	    __cData[code].candlesticks = __cData[code].candlesticks || {};
	    __cData[code].candlesticks.ticks = __cData[code].candlesticks.ticks || [];

        if (typeof __cData[code].candlesticks.open == 'undefined') __cData[code].candlesticks.open = [];
        if (typeof __cData[code].candlesticks.high == 'undefined') __cData[code].candlesticks.high = [];
        if (typeof __cData[code].candlesticks.low == 'undefined') __cData[code].candlesticks.low = [];
        if (typeof __cData[code].candlesticks.close == 'undefined') __cData[code].candlesticks.close = [];
        if (typeof __cData[code].candlesticks.volume == 'undefined') __cData[code].candlesticks.volume = [];
        if (typeof __cData[code].candlesticks.buyVolume == 'undefined') __cData[code].candlesticks.buyVolume = [];

        openTime = getFloat(item.t);
        closeTime = getFloat(item.T);
        low = getFloat(item.l);
        high = getFloat(item.h);
        open = getFloat(item.o);
        close = getFloat(item.c);
        volume = getFloat(item.v);
        assetVolume = getFloat(item.q);
        buyBaseVolume = getFloat(item.V);
        buyAssetVolume = getFloat(item.Q);
        trades = parseInt(item.n);

        __cData[code].candlesticks.ticks.push({
            openTime: openTime,
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume,
            closeTime: closeTime,
            assetVolume: assetVolume,
            trades: trades,
            buyBaseVolume: buyBaseVolume,
            buyAssetVolume: buyAssetVolume
        });

        __cData[code].candlesticks.open.push( open );
        __cData[code].candlesticks.high.push( high );
        __cData[code].candlesticks.low.push( low );
        __cData[code].candlesticks.close.push( close );
        __cData[code].candlesticks.volume.push( volume );
        __cData[code].candlesticks.buyVolume.push( buyBaseVolume );
    };

    const getReferredTicks = async code => {
        await b.candlesticks(code, "5m", (error, ticks, symbol) => {
            
            for (let i in ticks) {
                if (!isNaN(i)) {
                    [
                        time, 
                        open, 
                        high, 
                        low, 
                        close, 
                        volume, 
                        closeTime, 
                        assetVolume, 
                        trades, 
                        buyBaseVolume, 
                        buyAssetVolume, 
                        ignored
                    ] = ticks[i];

                    setCSArray({ 
                        t: time,
                        T: closeTime,
                        s: symbol,
                        o: open,
                        c: close,
                        h: high,
                        l: low,
                        v: volume,
                        n: trades,
                        q: assetVolume,
                        V: buyBaseVolume,
                        Q: buyAssetVolume,
                    });
                }
            }
        }, { 
            limit: 1000
        });
    }

    if (Array.isArray(code)) {
        for (let i in code)
            if (typeof code[i] != 'undefined')
                await getReferredTicks( code[i] )
        
    } else if (typeof code != 'undefined')
        await getReferredTicks( code )

    if (live) {
        getCandlestickData(code, res => {
            setCSArray(res.k);
        });
    }
}

function getTicks( code ) {
    return (isset(__cData[code]) && isset(__cData[code].candlesticks)) ? __cData[code].candlesticks : null;
}

function getTrades( code ) {
    return (isset(__cData[code]) && isset(__cData[code].trades)) ? __cData[code].trades : null;
}

function trades(code) {
    let prev;
    let curr;

    const setTradesArray = (item) => {
    	let code = item.s;
    	if (typeof code == 'undefined') return;

    	let minVol = code.find('BTC') && code != 'BTCUSDT' && code != 'BTCETH' ? 0.001 : (code.find('ETH') && code != 'ETHUSDT') ? 0.03 : 10;

	    __cData[code] = __cData[code] || {};
	    if (!isset(__cData[code].trades)) __cData[code].trades = [];

        item.t = moment(item.T).startOf('seconds').fromNow();

        var type = 'asks';
        var qty = getFloat(item.q);
        var price = getFloat(item.p);

        if (item.m) {
            // the maker made a buy
            type = 'bids';
        }

        //initialize vars
        if (typeof __cData[code].trades[type] == 'undefined') __cData[code].trades[type] = {};
        if (typeof __cData[code].trades[type].volume == 'undefined') __cData[code].trades[type].volume = 0;

        // set data holders properties
        if (typeof __cData[code].trades.data == 'undefined') __cData[code].trades.data = [];
        if (typeof __cData[code].trades[type].data == 'undefined') __cData[code].trades[type].data = [];

        // begin
        __cData[code].trades.data.push(item);
        __cData[code].trades[type].data.push(item);

        let volBTC = qty * price; // convert the volume to btc value

        /*
        //sum volume grouped per price
        if (typeof __cData[code].trades[type].volumePerPrice[price] == 'undefined') __cData[code].trades[type].volumePerPrice[price] = volBTC;
        else __cData[code].trades[type].volumePerPrice[price] = (__cData[code].trades[type].volumePerPrice[price] + volBTC);

        //sum volume grouped per time
        if (typeof __cData[code].trades[type].volumePerTime[item.t][price] == 'undefined') __cData[code].trades[type].volumePerTime[item.t][price] = volBTC;
        else __cData[code].trades[type].volumePerTime[item.t][price] = (__cData[code].trades[type].volumePerTime[item.t][price] + volBTC);
		*/
        //sum the volume total 
        if (typeof __cData[code].trades[type].volume == 'undefined') __cData[code].trades[type].volume = volBTC;
        else __cData[code].trades[type].volume = (getFloat(__cData[code].trades[type].volume) + volBTC);
    };

    getTradesData(code, res => {
        setTradesArray(res);
    });
}

function getTradesAVG(code) {
	if (
		!isset(__cData[code]) 
		|| !isset(__cData[code].trades) 
		|| !isset(__cData[code].trades['bids']) 
		|| !isset(__cData[code].trades['asks'])
	) return null;

	let { bids, asks } = __cData[code].trades;

	const __getAVG = (type, trades) => {
        if (typeof __cData[code].trades.avg == 'undefined') __cData[code].trades.avg = {};
        if (typeof __cData[code].trades[type] == 'undefined') __cData[code].trades[type] = {};
        if (typeof __cData[code].trades[type].avg == 'undefined') __cData[code].trades[type].avg = {};
        if (typeof __cData[code].trades[type].sumVolumes == 'undefined') __cData[code].trades[type].sumVolumes = 0;
        if (typeof __cData[code].trades[type].sumPrices == 'undefined') __cData[code].trades[type].sumPrices = 0;
        if (typeof __cData[code].trades[type].sumTime == 'undefined') __cData[code].trades[type].sumTime = 0;

		let counter = 0;
	    let curr;
	    let prev;
        for (let i in trades) {
        	if (isNaN(i)) continue;
		    let item = trades[i];

    		let code = item.s;
    		if (typeof code == 'undefined') return;

    		let qty = getFloat(item.q);
    		let price = getFloat(item.p);
        	let volBTC = qty * price; // convert the volume to btc value
		    curr = item;

    		let minVol = code.find('BTC') && code != 'BTCUSDT' && code != 'BTCETH' ? 0.001 : (code.find('ETH') && code != 'ETHUSDT') ? 0.03 : 10;

		    if (minVol < volBTC && !empty(prev)) {
		        //sum prices
		        if (typeof price != 'undefined' && !isNaN( getFloat( price ) * 1)) 
		            __cData[code].trades[type].sumPrices = price * 1 + getFloat(__cData[code].trades[type].sumPrices) * 1;
		        
		        //sum volumes 
		        if (typeof volBTC != 'undefined' && !isNaN(volBTC)) 
		            __cData[code].trades[type].sumVolumes = volBTC * 1 + getFloat(__cData[code].trades[type].sumVolumes) * 1;

		        //sum time difference between trades
		        __cData[code].trades[type].sumTime = Math.abs(moment(curr.T).diff(prev.T)) * 1 + __cData[code].trades[type].sumTime * 1;

		        counter++;
		    }
		    prev = curr;
        }

        //get avg for bids/asks trades 
        if (counter > 0) {
        	__cData[code].trades[type].avg.price = (__cData[code].trades[type].sumPrices / counter).toFixed(10);
	        __cData[code].trades[type].avg.volume = (__cData[code].trades[type].sumVolumes / counter).toFixed(10);
	        __cData[code].trades[type].avg.time = (__cData[code].trades[type].sumTime / counter / 1000).toFixed(3); // seconds
	        __cData[code].trades[type].avg.count = counter;
	    }
	}

	__getAVG('bids', bids.data);
	__getAVG('asks', asks.data);

    //get avg for all trades 
    let sumP = __cData[code].trades['bids'].sumPrices * 1 + __cData[code].trades['asks'].sumPrices * 1;
    let sumV = __cData[code].trades['bids'].sumVolumes * 1 + __cData[code].trades['asks'].sumVolumes * 1;
    let sumT = __cData[code].trades['bids'].sumTime * 1 + __cData[code].trades['asks'].sumTime * 1;
    let divi = __cData[code].trades['bids'].avg.count * 1 + __cData[code].trades['asks'].avg.count * 1;


    __cData[code].trades.avg.price = (sumP / divi).toFixed(10);
    __cData[code].trades.avg.volume = (sumV / divi).toFixed(10);
    __cData[code].trades.avg.time = (sumT / divi / 1000).toFixed(3);
    __cData[code].trades.avg.count = divi;
}

function sell(code, quantity, price, type, cb) {
    if (!code || !quantity) return;

    //get balance for this pair and sell it
    //TODO: track buy orders to sell the correct balance and avoid loose

    var c = code;
    type = (typeof type == 'undefined') ? 'MARKET' : 'LIMIT';
    b.useServerTime(() => {
        if (type == 'MARKET') {
            b.marketSell(c, quantity, (error, response) => {
            	try {
                    if (typeof cb == 'function') {
                        cb(response);
                    }
            	} catch(error) {
            		log(error);
            	}
            });
        } else {
            let pSell = (typeof price == 'undefined') ? botTrader[c].sell : price;
            b.sell(c, quantity, getFloat(pSell), { type: 'LIMIT' }, (error, response) => {
            	try {
                    if (typeof cb == 'function') {
                        cb(response);
                    }
            	} catch(error) {
            		log(error);
            	}
            });
        }
    });
}

function buy(code, quantity, price, type, cb) {
    if (!code || !quantity) return;

    var c = code;
    b.useServerTime(() => {
        if (type == 'MARKET') {
            b.marketBuy(c, quantity, (error, response) => {
            	try {
                    if (typeof cb == 'function') {
                        cb(response);
                    }
            	} catch(error) {
            		log(error);
            	}
            });
        } else {
            let pBuy = (typeof price == 'undefined') ? botTrader[c].buy : price;
            b.buy(c, quantity, getFloat(pBuy), { type: 'LIMIT' }, (error, response) => {
            	try {
                    if (typeof cb == 'function') {
                        cb(response);
                    }
            	} catch(error) {
                    log(error);
            	}
            });
        }
    });

}

async function cancel(code, orderId) {
    if (!isset(code) || empty(code)) return null;

    var c = code;

    if (isset(orderId) && !empty(orderId)) {
        return new Promise((resolve, reject) => {
            b.useServerTime(() => {
                b.cancel(c, orderId, (error, res) => {
                    if (error) {
                        reject(error.body);
                    } else {
                        resolve(res);
                    }
                });
            });
        });
    } else if (isset(orderId) && empty(orderId)) {
        return false;
    } else {
        return new Promise((resolve, reject) => {
            b.useServerTime(() => {
                b.cancelOrders(c, (error, res) => {
                    if (error) {
                        reject(error.body);
                    } else {
                        resolve(res);
                    }
                });
            });
        });
    }
}

function getExchangeInfo(code) {
    if (isset(__cData.currencies) && isset(__cData.currencies[code]) && isset(__cData.currencies[code].exchangeInfo)) {
        return __cData.currencies[code].exchangeInfo;
    } else {
        if (!isset(__cData.currencies)) __cData.currencies = {};

        return new Promise((resolve, reject) => {
            fetch()
            b.exchangeInfo((error, res) => {
                if (res.symbols && Array.isArray(res.symbols)) {
                    for (let obj of res.symbols) {

                        let filters = {
                            minNotional: 0.001,
                            minQty: 1,
                            maxQty: 10000000,
                            stepSize: 1,
                            minPrice: 0.00000001,
                            maxPrice: 100000
                        };

                        for (let filter of obj.filters) {
                            if (filter.filterType == "MIN_NOTIONAL") {
                                filters.minNotional = filter.minNotional;
                            } else if (filter.filterType == "PRICE_FILTER") {
                                filters.minPrice = filter.minPrice;
                                filters.maxPrice = filter.maxPrice;
                            } else if (filter.filterType == "LOT_SIZE") {
                                filters.minQty = filter.minQty;
                                filters.maxQty = filter.maxQty;
                                filters.stepSize = filter.stepSize;
                            }
                        }

                        if (!isset(__cData.currencies[obj.symbol])) __cData.currencies[obj.symbol] = {};
                        __cData.currencies[obj.symbol].exchangeInfo = filters;
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

async function loadBalances(cb) {
    return await new Promise((resolve, reject) => {
        b.useServerTime(() => {
            b.balance((error, res) => {
                if (error) {
                    reject(error.body);
                } else {
                    if (typeof cb == 'function') {
                        cb(res);
                    }
                    /* response json 
                    {
                        BTC: { available: '0.00000062', onOrder: '0.00000000' },
                        LTC: { available: '0.00000000', onOrder: '0.00000000' },
                        ETH: { available: '0.00000000', onOrder: '0.00000000' }
                    }
                    */
                    resolve(res);
                }
            });
        });
    });
}

function handleBalances(balances) {
    for (let i in balances) {
        let { available, onOrder } = balances[i];
        let symbol = i;
        let code = '';
        let price = 0;

        if (symbol == 'BTC') {
            code = 'BTCUSDT';
            price = getPrices( code );

            if (price && available > 0.001) {//TODO: get exchange info min. btc tradeable qty
                if (!isset(__cData.balances)) __cData.balances = {};
                if (!isset(__cData.balances[ symbol ])) __cData.balances[ symbol ] = {};

                __cData.balances[ symbol ] = {
                    btc: {
                        available,
                        onOrder
                    },
                    usdt: {
                        available: (getFloat(available) * getFloat(price)).toFixed(2),
                        onOrder: (getFloat(onOrder) * getFloat(price)).toFixed(2),
                    },
                    available,
                    onOrder
                };
            }
        } else if (symbol == 'USDT') {
            code = 'BTCUSDT';
            price = getPrices( code );

            if (price && available > 10) {//TODO: get exchange info min. usdt tradeable qty
                if (!isset(__cData.balances)) __cData.balances = {};
                if (!isset(__cData.balances[ symbol ])) __cData.balances[ symbol ] = {};

                __cData.balances[ symbol ] = {
                    btc: {
                        available: (getFloat(available) / getFloat(price)).toFixed(8),
                        onOrder: (getFloat(onOrder) / getFloat(price)).toFixed(8),
                    },
                    usdt: {
                        available,
                        onOrder
                    },
                    available,
                    onOrder
                };
            }
        } else {
            code = symbol+'BTC';
            priceBTC = getPrices( code );
            priceUSDT = getPrices( symbol+'USDT' );

            if (priceBTC && (getFloat(available) * getFloat(priceBTC)) > 0.001) {//TODO: get exchange info min. btc tradeable qt
                if (!isset(__cData.balances)) __cData.balances = {};
                if (!isset(__cData.balances[ symbol ])) __cData.balances[ symbol ] = {};

                __cData.balances[ symbol ] = {
                    btc: {
                        available: (getFloat(available) * getFloat(priceBTC)).toFixed(8),
                        onOrder: (getFloat(onOrder) * getFloat(priceBTC)).toFixed(8),
                    },
                    available,
                    onOrder
                };
                
                if (priceUSDT) {
                    __cData.balances[ symbol ].usdt = {
                        available: (getFloat(available) * getFloat(priceUSDT)).toFixed(2),
                        onOrder: (getFloat(onOrder) * getFloat(priceUSDT)).toFixed(2),
                    };
                }
            }
        }
    }
}

async function getBalance(code, forceUpdate) {
    if (forceUpdate) await loadBalances( handleBalances );

    if (!isset(code) || empty(code)) {
        return __cData.balances;
    } else {
        let symbol = rtrim(code, b.getMarket( code ));
        return __cData.balances[ symbol ];
    }
}

async function getOrders(type, code, forceUpdate) {
    type = (!isset(type) || empty(type)) ? false : (type=='all') ? false : type;
    code = (isset(code) && !empty(code)) ? code : false;

    if (forceUpdate) await getExOrders( type, code, handleOrders );

    if (!isset(type) || empty(type)) {
        if (!isset(code) || empty(code)) {
            return isset(__cData.orders) ? __cData.orders : {};
        } else {
            let r = {};
            if (isset(__cData.orders)) { 
                return Object.keys(__cData.orders).map(k=>{
                    r[k] = isset(__cData.orders[k][code]) && !empty(__cData.orders[k][code]) ? __cData.orders[k][code] : [];
                });
            }
            return r;
        }        
    } else {
        if (!isset(code) || empty(code)) {
            return isset(__cData.orders[type]) ? __cData.orders[type] : {};
        } else {
            let r = {};
            if (isset(__cData.orders[k])) { 
                return Object.keys(__cData.orders[type]).map(k=>{
                    r[k] = isset(__cData.orders[k][code]) && !empty(__cData.orders[k][code]) ? __cData.orders[k][code] : [];
                });
            }
            return r;
        } 
    }
}


async function loadOrders( type, code, cb ) {
    return await getExOrders(type, code, cb );
}

function getExOrders(type, code, cb) {
    type = (isset(type) && !empty(type)) ? type : '';
    code = (isset(code) && !empty(code)) ? code : false;

    switch(type.toLowerCase()) {
        case 'open':
            return new Promise((resolve, reject) => {
                b.openOrders(code, (error, res) => {
                    try {
                        /*
                        return 
                        [
                            { 
                                symbol: 'MATICBTC',
                                orderId: 21819133,
                                clientOrderId: 'web_3e0a1bace630489bb8e3a837e7e323f3',
                                price: '0.00000058',
                                origQty: '3237.00000000',
                                executedQty: '0.00000000',
                                cummulativeQuoteQty: '0.00000000',
                                status: 'NEW',
                                timeInForce: 'GTC',
                                type: 'LIMIT',
                                side: 'BUY',
                                stopPrice: '0.00000000',
                                icebergQty: '0.00000000',
                                time: 1565592787346,
                                updateTime: 1565592787346,
                                isWorking: true 
                            },
                            {
                                ...
                            }
                        ]
                         */
                        if (typeof cb == 'function') cb(res);                        
                        resolve(res);
                    } catch(error) {
                        log(error);
                        reject(error);
                    }
                });
            });
            break;
        default:
            if (!code) {
                log('Have to specify a crypto pair', 'error');
                return false;
            } else {
                return new Promise((resolve, reject) => {
                    b.allOrders(code, (error, res, symbol) => {
                        log(res);
                        log(symbol);
                        try {
                            log(res);
                            if (typeof cb == 'function') cb(res);                        
                            resolve(res);
                        } catch(error) {
                            log(error);
                            reject(error);
                        }
                    });
                });
            }
        break;
    }
}

function getOrderStatus(code, orderId) {
    if (!isset(code) || empty(code)) return;

    var c = code;

    return new Promise((resolve, reject) => {
        b.orderStatus(c, orderId, (error, res) => {
            if (error) {
                reject(error);
            } else {
                resolve(res);
            }
        });
    });
}

function handleOrders(orders) {
    for (let i in orders) {
        if (!isNaN(i)) {
            let order = orders[i];
            let code = order.symbol;
            let type = order.status == 'NEW' ? 'open' : order.status.toLowerCase(); //NEW, CANCELED, REPLACED, REJECTED, TRADE, EXPIRED

            /*
            order = { 
                symbol: 'MATICBTC',
                orderId: 21819133,
                clientOrderId: 'web_3e0a1bace630489bb8e3a837e7e323f3',
                price: '0.00000058',
                origQty: '3237.00000000',
                executedQty: '0.00000000',
                cummulativeQuoteQty: '0.00000000',
                status: 'NEW',
                timeInForce: 'GTC',
                type: 'LIMIT',
                side: 'BUY',
                stopPrice: '0.00000000',
                icebergQty: '0.00000000',
                time: 1565592787346,
                updateTime: 1565592787346,
                isWorking: true 
            }
            */
            if (!empty(order)) {
                if (!isset(__cData.orders)) __cData.orders = {};
                if (!isset(__cData.orders[type])) __cData.orders[type] = {};
                if (!isset(__cData.orders[type][code])) __cData.orders[type][code] = [];

                if (!isset(__cData[ code ])) __cData[ code ] = {};
                if (!isset(__cData[ code ].orders)) __cData[ code ].orders = {};
                if (!isset(__cData[ code ].orders[type])) __cData[ code ].orders[type] = [];

                __cData.orders[type][ code ].push( order );
                __cData[ code ].orders[type].push( order );
            }
        }
    }
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
    
    getData,
    terminateSubscriptions,

    addChange,
    getAVGChanges,
    getActualChange,
    getFirstChange,
    getLastChange,
    getChange,
    getChanges,
    getAVGChanges,

    addDepthChange,
    getDepthChange,

    getPrices,
    getMarket,
    getOrders,
    getExOrders,
    getExPrices,
    getTradesData,
    getTrades,
    getTradesAVG,
    getTicks,
    getTickersData,
    getOrderStatus,
    getDepthCacheData,
    getDepthData,
    get24hData,
    getCandlestickData,
    getExchanger,
    currencyFilter,

    sell,
    buy,
    cancel,

    getCurrencyList,
    getSymbols,

    thPriceDirection,
    thWhichIsBigger,
    thSpeed,

    obPriceDirection,
    obWhichIsBigger,
    obGetRisk,

    csTopPrice,
    csBottomPrice,

    predictPriceDirection,

    depth,
    candlesticks,
    trades,

    getBalance,
    loadBalances,
    getExchangeInfo
};