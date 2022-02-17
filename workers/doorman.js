const common = require('../src/functions/common');

const { log, isset, empty, getFloat, notify } = common;
const data = {};

data.often = {}; //record how many times a crypto satisfies all criterias 
data.list = []; //record all cryptos that has satisfied all criterias 

function init( ex, ...options ) {

    if (myData.get('debug')) log('Checking functions exists: get24HData and addChange');
    if (!isset(ex) && !isset(ex.get24hData) && !isset(ex.addChange)) return false;

    if (!isset(data.ex)) data.ex = ex;
    if (myData.get('debug')) log('Adding criterias...');
    addCriteria(__cVolumeMin);
    addCriteria(__cPriceMin);
    addCriteria(__cPriceIncreased);

    return this;
}

function isOK() {
    let ok = true;
    //TODO: check if the script can run 
    return ok;
}

function start() {
    if (myData.get('debug')) log('Starting the Doorman');
    __listen();
    setTimeout(function(){
        __callCriteria();
    }, 3 * 1000);
    let interval = setInterval(function(){
        //__listen();
        __callCriteria();
    }, 1 * 60 * 1000);
}

function addCriteria( ...fnName ) {
    if (!isset(data.criterias)) data.criterias = [];

    if (myData.get('debug')) log('Adding criteria '+ fnName);
    if (Array.isArray(fnName)) {
        data.criterias = [...data.criterias, ...fnName];
    } else if (!empty(fnName) && typeof fnName == 'function') {
        data.criterias.push( fnName );
    }

    if (myData.get('debug')) log('Deleting duplicated criterias');
    data.criterias.filter((v, k, a) => a.indexOf(v) === k);
}

function getCriterias() {
    return data.criterias;
}

function getData() {
    return data;
}

function __listen() {
    if (!isset(data.ex)) return false;

    //start to listen cryptos 
    data.ex.get24hData([], r => {
  
    if (myData.get('debug')) log(r);
        //record crypto data for post manipulation
        data.ex.addChange({
            id: common.generateId(),
            code: r.symbol,
            bidPrice: getFloat(r.bestBid).toFixed(8),
            bidQty: getFloat(r.bestBidQty),
            askPrice: getFloat(r.bestAsk).toFixed(8),
            askQty: getFloat(r.bestAskQty),
            priceBuy: getFloat(r.bestBid).toFixed(8),
            volume: getFloat(r.volume),
            quoteVolume: getFloat(r.quoteVolume),
            percentDiff: 0,
            percentProfit: data.ex.config.get('percentProfit'),
            percentToWatch: data.ex.config.get('percentToWatch'),
            priceSell: getFloat((r.bestBid * (data.ex.config.get('percentProfit') / 100 + 1)).toFixed(8)),
            open:r.open,
            close:r.close,
            high:r.high,
            low:r.low,
            openTime:r.openTime,
            closeTime:r.closeTime,
            closeQty:r.closeQty,
            averagePrice:r.averagePrice,
            numTrades:r.numTrades,
            prevClose:r.prevClose
        });
    });
}


async function backtesting(symbol, period, cb) {
    return await data.ex.candlesticks(symbol, period, function(error, data) {
        let ticks = data.data;
 
        let chart = {
            lowest:100000000000000,
            highest:0,
            ohlc:{},
            trends:[],
            breakers:[],
            length:Object.keys(ticks).length
        };

        let amplitud = 0;
        let ticksCount = 1;
        let startZone = false;
        let prevTick = false;
        Object.keys(ticks).reverse().map(i => {


            if (chart.lowest > ticks[i].low) {
                chart.lowest = ticks[i].low;
                
                if (!isset(chart.ohlc.lowest)) chart.ohlc.lowest = {};
                chart.ohlc.lowest = ticks[i];
                chart.ohlc.lowest.date = new Date(ticks[i].id*1000);
                chart.ohlc.lowest.symbol = symbol;
            }

            if (chart.highest < ticks[i].high) {
                chart.highest = ticks[i].high;
                
                if (!isset(chart.ohlc.highest)) chart.ohlc.highest = {};
                chart.ohlc.highest = ticks[i];
                chart.ohlc.highest.date = new Date(ticks[i].id*1000);
                chart.ohlc.highest.symbol = symbol;
            }

            if (i>0) {
                /*
                trend changes 
                - prev close == current open 
                - spread from prev trend breaker to this is greater than 0.7%
                */

                ticks[i].bodyLen = bodyLen(ticks[i]).toFixed(2);
                ticks[i].wickLen = wickLen(ticks[i]).toFixed(2);
                ticks[i].tailLen = tailLen(ticks[i]).toFixed(2);
                ticks[i].nextMove = !isBullish(ticks[i]) ? 'UP' : 'DOWN';
                ticks[i].isEngulfed = isEngulfed(ticks[i-1], ticks[i]);
                ticks[i].date = new Date(ticks[i].id*1000).toLocaleString();
                ticks[i].spread = Math.abs( (1 - ticks[i].high / ticks[i].low) * 100 ).toFixed(4);
                amplitud = ( isBullish(ticks[i-1]) == isBullish(ticks[i]) ) ? amplitud+ticks[i].spread*1 : amplitud-ticks[i].spread*1;
                ticks[i].amplitud = Math.abs( amplitud ).toFixed( 4 );
                ticks[i].distance = ticksCount;

                if ( isBullish(ticks[i-1]) != isBullish(ticks[i]) ) { //change direction
                    if ( chart.trends.length > 0 ) {
                        let j = chart.trends.length - 1;
                        let spread = Math.abs( (1 - Math.min( chart.trends[j].open, chart.trends[j].close ) / Math.max( ticks[i].open, ticks[i].close ).toFixed(2)) * 100 ).toFixed(4);

                        if (spread >= 0.7) {
                            ticks[i].accumZone = [ startZone, prevTick ];
                            ticks[i].spreadFromLastBreak = spread;
                            ticksCount = 0;
                            chart.breakers.push( ticks[i] );
                            startZone = false;
                        } else { //accumulation period
                            if (!startZone) startZone = ticks[i];
                        }
                    }

                    chart.trends.push( ticks[i] );
                }
            }
            ticksCount++;
            prevTick = ticks[i];


        });

        if (!error && typeof cb == 'function') cb([ chart, ticks ]);
    });
}

if (!isset(data.trends)) data.trends = {};
function showBTCBP() {
    let symbol = 'btcusdt';
    let strRepeatNumber = 116; 
    const printBK = (chart, ticks, period) => {        
        toprint = '\n**** BREAK POINTS for '+ period +' ****. Actualizado: '+ (Date().toLocaleString()) +'\n';
        toprint += '-'.repeat(strRepeatNumber) +'\n';
        toprint += 'SYMBOL\t\tSIGNAL\t\tENTRY/OUT POINT\t\tVolume\t\t\tDistance\t\tDate\n';
        toprint += '='.repeat(strRepeatNumber) +'\n';
        let firstOne = true;
        chart.breakers.reverse().slice(0,4).map( (bp,i) => {
            /*
            {
                id: 1613082000,
                open: 47156.35,
                close: 47269.5,
                low: 47123.33,
                high: 47386.6,
                amount: 98.07470247864222,
                vol: 4639824.052836859,
                count: 4547,
                bodyLen: '113.15',
                wickLen: '117.10',
                tailLen: '33.02',
                nextMove: 'DOWN',
                isEngulfed: true,
                date: 'Thu Feb 11 2021 18:20:00 GMT-0400 (Venezuela Time)',
                spread: '0.5587',
                amplitud: '3.2198',
                distance: 17,
                accumZone: [ [Object], [Object] ],
                spreadFromLastBreak: '1.0892'
            }
            */
            if (isset(bp)) {
                toprint += symbol +'\t\t';
                toprint += ((bp.nextMove == 'UP')?'BUY\t\t': 'SELL\t\t');
                toprint += `${getFloat(bp.close).toFixed(2)} \t\t${bp.vol.toFixed(4)} \t\t${bp.distance}\t\t${bp.date}\t\t`;
                toprint += '\n';


                if (!isset(data.trends[symbol+':'+period]) && firstOne) data.trends['btcusdt:'+period] = bp;
                else if (data.trends[symbol+':'+period].date != bp.date && firstOne) {
                    data.trends[symbol+':'+period] = bp;
                    notify(
                        'BTCUSDT Trend Breaks '+ bp.nextMove, 
                        `Period: ${period}\nOpen: ${bp.open}\nClose: ${bp.close}\nDate: ${bp.date}`
                    );
                }
                firstOne = false;

            }
        });
        toprint += '-'.repeat(strRepeatNumber) +'\n';
        toprint += '**** /BREAK POINTS FOR '+ period +' ****\n\n';
        log( toprint );
    }
 
    backtesting(symbol, '1week', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '1week');
    }));

    backtesting(symbol, '1day', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '1day');
    }));

    backtesting(symbol, '4hour', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '4hour');
    }));

    backtesting(symbol, '60min', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '60min');
    }));
    
    backtesting(symbol, '30min', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '30min');
    }));
    
    backtesting(symbol, '15min', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '15min');
    }));
    
    backtesting(symbol, '5min', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '5min');
    }));
    
    backtesting(symbol, '1min', (d => { 
        let chart = d[0]; 
        let ticks = d[1];
        printBK(chart, ticks, '1min');
    }));
}

var _trading = {}, _capital = 500;
async function __callCriteria() {
    if (!isset(data.ex)) return false;
    

    showBTCBP();
    return;


    if (myData.get('debug')) log('Getting historic changes');
    // get all symbols picked up until now 
    let changes = data.ex.getData(false, 'changes');
    if (!empty(changes)) {
        if (myData.get('debug')) log('Filtering pairs changes');
        let symbols = Object.keys( changes );
        let tplOutput = '';
        let strRepeatNumber = 150;
        for (i in symbols) {
            if (!isNaN(i)) {
                let symbol = symbols[i];

                if (myData.get('debug')) log('Getting last and current changes');
                // get symbol changes recorded until now 
                let current = data.ex.getActualChange(symbol);
                let prev = data.ex.getLastChange(symbol);
                if (myData.get('debug')) log('Getting criterias to aplly to changes');
                let results = {};
                let criterias = getCriterias();
                if (current && prev) {

                    if (current.percentChange >= myData.get('config:percentProfit')) {

                        let passed = {};

                        if (current.volumeDiffProgressive > 0 && current.volumeDiff > 0) {
                            if (!myData.get(symbol+':occurrences')) myData.set(symbol+':occurrences', 1);
                            else myData.set(symbol+':occurrences', myData.get(symbol+':occurrences')*1+1);
                            passed['volume'] = true;
                        } else {
                            passed['volume'] = false;
                        }

                        if (myData.get(symbol+':occurrences') >= myData.get('config:occurrences')) {
                            myData.set(symbol+':occurrences', 1);


                            passed['moda'] = true;

                            if (!myData.get(symbol+':confirmations')) myData.set(symbol+':confirmations', 1);
                            else myData.set(symbol+':confirmations', myData.get(symbol+':confirmations')*1+1);
                        } else {
                            passed['moda'] = false;
                        }

                        if (myData.get(symbol+':confirmations') >= myData.get('config:confirmations') && isset(passed['moda']) && passed['moda']) {
                            tplOutput += symbol + (symbol.length<8?'\t\t':'\t')+ current.percentChange +'\t\t\t'+ current.volumeDiff +'\n';
                            let profitPercent = 1+myData.get('config:percentProfit')/100;


                            //find break points 
                            backtesting(symbol, '5min', (d => { 
                                let chart = d[0]; 
                                let ticks = d[1];

                                toprint = '\n**** BREAK POINTS ****\n';
                                toprint += '-'.repeat(strRepeatNumber) +'\n';
                                toprint += 'SYMBOL\t\tSIGNAL\t\tENTRY/OUT POINT\t\tVolume\t\t\tDistance\t\tDate\n';
                                toprint += '='.repeat(strRepeatNumber) +'\n';
                                chart.breakers.reverse().slice(0,5).map( bp => {
                                    /*
                                    {
                                        id: 1613082000,
                                        open: 47156.35,
                                        close: 47269.5,
                                        low: 47123.33,
                                        high: 47386.6,
                                        amount: 98.07470247864222,
                                        vol: 4639824.052836859,
                                        count: 4547,
                                        bodyLen: '113.15',
                                        wickLen: '117.10',
                                        tailLen: '33.02',
                                        nextMove: 'DOWN',
                                        isEngulfed: true,
                                        date: 'Thu Feb 11 2021 18:20:00 GMT-0400 (Venezuela Time)',
                                        spread: '0.5587',
                                        amplitud: '3.2198',
                                        distance: 17,
                                        accumZone: [ [Object], [Object] ],
                                        spreadFromLastBreak: '1.0892'
                                    }
                                    */
                                    if (isset(bp)) {
                                        toprint += symbol +'\t\t';
                                        toprint += ((bp.nextMove == 'UP')?'BUY\t\t': 'SELL\t\t');
                                        toprint += `${bp.close} \t\t${bp.vol.toFixed(4)} \t\t${bp.distance}\t\t${bp.date}\t\t`;
                                        toprint += '\n\n';
                                    }
                                });
                                toprint += '-'.repeat(strRepeatNumber) +'\n';
                                toprint += '**** /BREAK POINTS ****\n\n';
                                log( toprint );
                            }));

                            /*
                            data.ex.getTrades(_trading, symbol, function(d,e){
                                if (!isset(e)) {

                                    let $trades = {};
                                    const __getAVGTrades = ($trades, trades) => {
                                        let counter = 0;
                                        let curr;
                                        let prev;
                                        for (let i in trades) {
                                            if (isNaN(i)) continue;
                                            let __item = trades[i];

                                            let t =  __item.data;
                                            for (let j in t) {
                                                if (isNaN(j)) continue;
                                                let item = t[j];

                                                let qty = getFloat(item.amount);
                                                let price = getFloat(item.price);
                                                let vol = qty * price; // convert the volume to btc value

                                                curr = item;

                                                let minVol = 10;

                                                if (minVol < vol && !empty(prev)) {
                                                    //sum prices
                                                    if (typeof price != 'undefined' && !isNaN( getFloat( price ) * 1)) 
                                                        $trades.sumPrices = price * 1 + getFloat($trades.sumPrices) * 1;
                                                    
                                                    //sum volumes 
                                                    if (typeof vol != 'undefined' && !isNaN(vol)) 
                                                        $trades.sumVolumes = vol * 1 + getFloat($trades.sumVolumes) * 1;

                                                    if (item.direction=='buy') {
                                                        $trades.buying = getFloat($trades.buying)*1 + vol*1;
                                                    } else {
                                                        $trades.selling = getFloat($trades.selling)*1 + vol*1;
                                                    }
                                                    counter++;
                                                }
                                                prev = curr;
                                            }

                                            //sum time difference between trades
                                            if (!isset($trades.sumTime)) $trades.sumTime = 0;
                                            if (i>=1) $trades.sumTime = Math.abs(parseInt(trades[i].ts)*1 - parseInt(trades[i-1].ts)*1)/1000 + parseInt($trades.sumTime) * 1;


                                            //get avg for bids/asks trades 
                                            if (counter > 0) {
                                                if (!isset($trades.avg)) $trades.avg = {};
                                                $trades.avg.price = ($trades.sumPrices / counter).toFixed(10);
                                                $trades.avg.volume = ($trades.sumVolumes / counter).toFixed(10);
                                                $trades.avg.time = ($trades.sumTime / counter).toFixed(3); // seconds
                                                $trades.avg.count = counter;
                                            }
                                        }
                                    }

                                    if (isset(d)) Object.values(d).map(v=>__getAVGTrades(_trading, $trades, d));
                                    
                                    if ($trades.avg.time <= 20) {
                                        log( $trades );
                                        if (!isset(_trading[symbol])) {
                                            _trading[symbol] = {
                                                //buy:(current.bidPrice/profitPercent).toFixed(8), 
                                                buy:current.askPrice, 
                                                sell:(current.bidPrice * profitPercent).toFixed(8),
                                                sl:(current.bidPrice/1.01).toFixed(8),
                                                symbol:symbol
                                            };
                                        }

                                    }

                                }
                            });
                            */




                            if (isset(_trading[symbol])) {
                                if (isset(_trading[symbol].sell)) {
                                    //entry point
                                    if(!isset(_trading[symbol].maker) && _trading[symbol].buy >= current.bidPrice) _trading[symbol].maker = current.bidPrice;

                                    //take profit
                                    if (isset(_trading[symbol].maker) && _trading[symbol].sell <= current.bidPrice) _trading[symbol].taker = current.bidPrice;
                                    if (isset(_trading[symbol].maker) && _trading[symbol].sell <= _trading[symbol].sl) _trading[symbol].taker = current.bidPrice;

                                    //pnl
                                    if (isset(_trading[symbol].taker)) {
                                        _trading[symbol].pnl = (_trading[symbol].taker / _trading[symbol].maker).toFixed(4)-1;
                                        _trading[symbol].profit = '$'+ (_capital * (_trading[symbol].pnl)).toFixed(4);
                                        _trading[symbol].roe = (_trading[symbol].pnl * 100).toFixed(4) +'%';
                                    } else {
                                        _trading[symbol].pnl = (current.bidPrice / _trading[symbol].maker - 1).toFixed(4);
                                        _trading[symbol].roe = (_trading[symbol].pnl * 100).toFixed(4) +'%';
                                    }
                                }

                                _trading[symbol].ask = current.askPrice;
                                _trading[symbol].bid = current.bidPrice;
                                _trading[symbol].spread = (current.bidPrice/current.askPrice/100).toFixed(8) +'%';
                            }
                        }

                        if (Object.values(passed).filter(item => item == true).length  == Object.keys(passed).length) {
                            if (!inList(symbol)) addToList( symbol );
                        } else if (isset(data.list[symbol])) { // does not satisfy criterias, then remove it
                            deleteFromList( symbol );
                        }
                    } else if (isset(data.list[symbol])) { // does not satisfy criterias, then remove it
                        deleteFromList( symbol );
                    }
                    

                    /*
                    for (let i in criterias) {
                        if (myData.get('debug')) log('Applying criteria '+ criterias[i].name);
                        if (typeof criterias[i] == 'function' && !isNaN(i)) results[criterias[i].name] = criterias[i](...[current, prev]);
                        if (myData.get('debug')) log('Results for criteria '+ criterias[i].name +': '+ results[criterias[i].name]);
                    }

                    if (Object.values(results).filter(item => item == 'BUY').length  == Object.keys(results).length) {
                        data.often[symbol] = isset(data.often[symbol]) ? data.often[symbol] + 1 * 1 : 1;

                        if (data.often[symbol] >= data.ex.config.get('volumeOcurrences')) { // satisfies criteria A, then pass to step 3
                            if (!inList(symbol)) addToList( symbol );
                        } else if (isset(data.list[symbol])) { // does not satisfy criteria A, then remove it
                            deleteFromList( symbol );
                        }
                    } else if (isset(data.list[symbol])) { // does not satisfy criteria A, then remove it
                        deleteFromList( symbol );
                    }
                    */
                }

                if (isset(data.list) && data.list.length > 0) {
                    updateList();
                }
            }
        }

        if (tplOutput.length > 0) {
            log( 
                '\n' + 
                '='.repeat(strRepeatNumber) + 
                '\nSYMBOL\t\tPrice Change %\t\tVolumen Change %\n' +
                '-'.repeat(strRepeatNumber) +
                '\n' + 
                tplOutput +
                '\n' + 
                '='.repeat(strRepeatNumber)
            );
        }
    }

    /*
    log( _trading );
    let trades = Object.values(_trading).filter( i => { return isset(i.profit) });

    log ( trades );
    log ({ 
        orders:Object.keys(_trading).length, 
        closed:trades.length, 
        open: (Object.keys(_trading).length - trades.length), 
        earns:(trades.length>0?trades.map(v=>{v.profit.replace(/\D/ig,'')}).reduce((accum, item) => { accum*1 + item*1 }):0)
    });
    */
}

function getDoorman() {
    return this;
}

function getList() {
    return data.list.filter((v, k, a) => a.indexOf(v) === k);
}

function updateList() {
	data.list = getList();
    myData.set('doormanList', data.list);
}

function inList( code ) {
    return isset(data.list[code]);
}   

function deleteFromList( code ) {
    data.list.splice( data.list.indexOf( code ), 1);
    updateList();
}

function addToList( code ) {
    data.list.push( code );
    updateList();
}

function __cVolumeMin(...args) {
    const [ current, prev ] = args;

    return parseInt(current.volume) >= 20 ? 'PASSED' : null;
}

function __cPriceMin(...args) {
    const [ current, prev ] = args;
    return getFloat(current.priceBuy) >= 0.000005 ? 'BUY' : null;
}

function __cPriceIncreased(...args) {
    const [ current, prev ] = args;
    return prev.percentChange > data.ex.config.get('percentToWatch') ? 'BUY' : null;
}

module.exports = {
    init,
    start,
    isOK,
    getDoorman,
    addCriteria,
    getCriterias,
    getData,
    getList,
    addToList,
    deleteFromList
}





















/*************************************************************************************
/*************************************************************************************
/*************************************************************************************
/*************************************************************************************
/*************************************************************************************/

function bodyLen(candlestick) {
    return Math.abs(candlestick.open - candlestick.close);
}

function wickLen(candlestick) {
    return candlestick.high - Math.max(candlestick.open, candlestick.close);
}

function tailLen(candlestick) {
    return Math.min(candlestick.open, candlestick.close) - candlestick.low;
}

function isBullish(candlestick) {
    return candlestick.open < candlestick.close;
}

function isBearish(candlestick) {
    return candlestick.open > candlestick.close;
}

function isHammerLike(candlestick) {
    return tailLen(candlestick) > (bodyLen(candlestick) * 2) &&
           wickLen(candlestick) < bodyLen(candlestick);
}

function isInvertedHammerLike(candlestick) {
    return wickLen(candlestick) > (bodyLen(candlestick) * 2) &&
           tailLen(candlestick) < bodyLen(candlestick);
}

function isEngulfed(shortest, longest) {
    return bodyLen(shortest) < bodyLen(longest);
}

function isGap(lowest, upmost) {
    return Math.max(lowest.open, lowest.close) < Math.min(upmost.open, upmost.close);
}

function isGapUp(previous, current) {
    return isGap(previous, current);
}

function isGapDown(previous, current) {
    return isGap(current, previous);
}

// Dynamic array search for callback arguments.
function findPattern(dataArray, callback) {
    const upperBound = (dataArray.length - callback.length) + 1;
    const matches = [];

    for (let i = 0; i < upperBound; i++) {
        const args = [];

        // Read the leftmost j values at position i in array.
        // The j values are callback arguments.
        for (let j = 0; j < callback.length; j++) {
            args.push(dataArray[i + j]);
        }

        // Destructure args and find matches.
        if (callback(...args)) {
            matches.push(args[1]);
        }
    }

    return matches;
}

// Boolean pattern detection.
// @public

function isHammer(candlestick) {
    return isBullish(candlestick) &&
           isHammerLike(candlestick);
}

function isInvertedHammer(candlestick) {
    return isBearish(candlestick) &&
           isInvertedHammerLike(candlestick);
}

function isHangingMan(previous, current) {
    return isBullish(previous) &&
           isBearish(current) &&
           isGapUp(previous, current) &&
           isHammerLike(current);
}

function isShootingStar(previous, current) {
    return isBullish(previous) &&
           isBearish(current) &&
           isGapUp(previous, current) &&
           isInvertedHammerLike(current);
}

function isBullishEngulfing(previous, current) {
    return isBearish(previous) &&
           isBullish(current) &&
           isEngulfed(previous, current);
}

function isBearishEngulfing(previous, current) {
    return isBullish(previous) &&
           isBearish(current) &&
           isEngulfed(previous, current);
}

function isBullishHarami(previous, current) {
    return isBearish(previous) &&
           isBullish(current) &&
           isEngulfed(current, previous);
}

function isBearishHarami(previous, current) {
    return isBullish(previous) &&
           isBearish(current) &&
           isEngulfed(current, previous);
}

function isBullishKicker(previous, current) {
    return isBearish(previous) &&
           isBullish(current) &&
           isGapUp(previous, current);
}

function isBearishKicker(previous, current) {
    return isBullish(previous) &&
           isBearish(current) &&
           isGapDown(previous, current);
}

// Pattern detection in arrays.
// @public

function hammer(dataArray) {
    return findPattern(dataArray, isHammer);
}

function invertedHammer(dataArray) {
    return findPattern(dataArray, isInvertedHammer);
}

function hangingMan(dataArray) {
    return findPattern(dataArray, isShootingStar);
}

function shootingStar(dataArray) {
    return findPattern(dataArray, isShootingStar);
}

function bullishEngulfing(dataArray) {
    return findPattern(dataArray, isBullishEngulfing);
}

function bearishEngulfing(dataArray) {
    return findPattern(dataArray, isBearishEngulfing);
}

function bullishHarami(dataArray) {
    return findPattern(dataArray, isBullishHarami);
}

function bearishHarami(dataArray) {
    return findPattern(dataArray, isBearishHarami);
}

function bullishKicker(dataArray) {
    return findPattern(dataArray, isBullishKicker);
}

function bearishKicker(dataArray) {
    return findPattern(dataArray, isBearishKicker);
}