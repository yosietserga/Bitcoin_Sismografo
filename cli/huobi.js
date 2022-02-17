const common = require('../src/functions/common');
const managerWorker = require('../workers/manager');

const tulind = require('tulind');

const { log, isset, empty, getFloat } = common;

/******* TESTING HUOBI API ********/
const Huobi = require('node-huobi-api');
const getNewH = (key, secret) => {
    return Huobi().options({
        APIKEY: key,
        APISECRET: secret,
        useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
        recvWindow: 60000, // Set a higher recvWindow to increase response timeout
        verbose: true, // loogging everything
        log: function (...args) {
            common.log(Array.prototype.slice.call(args), 'info', 1);
        }
    });
};
const bt = getNewH(
    '311b74fd-nbtycf4rw2-d1737fa4-9f0f4',
    '0e94c26f-b252c850-2d73cb85-b1e2c'
);

	//set base to compare
	//bt.bookTickers restful
	bt.bookTickers( ( error, data ) => {
        data.map( r => {
/*
	        ex.addChange({
	            id: common.generateId(),
	            code: r.symbol,
	            volume: (r.amount).toFix(4),
	            quoteVolume: (r.vol).toFix(4),
	            percentChange: 0,
	            percentDiff: 0,
	            percentProfit: data.ex.config.get('percentProfit'),
	            percentToWatch: data.ex.config.get('percentToWatch'),
	            open:r.open,
	            close:r.close,
	            high:r.high,
	            low:r.low
	        });
*/
	        log( {
	            id: common.generateId(),
	            code: 		r.symbol,
	            volume: 	(r.amount).toFix(4),
	            quoteVolume:(r.vol).toFix(4),
	            open:		(r.open).toFixed(8),
	            close:		(r.close).toFixed(8),
	            high:		(r.high).toFixed(8),
	            low:		(r.low).toFixed(8),
	            percentChange: 0,
	            percentDiff: 0
	        } );

        });
	});

log(
	bt.openOrders( null, ( ...args ) => {
        log( args );
	})
);
/******* /TESTING HUOBI API ********/
 
//managerWorker.start( bt );

let intervalWS = setInterval(terminateSubscriptions, 5 * 60 * 1000); // close all websocket connections every 5 minutes

function terminateSubscriptions() {
    bt.terminateSubscriptions();
}

function prompt(question, cb=null) {
    rl.question(
        question,
        answer => {
            if (typeof cb == 'function') {
                cb(answer);
            }
            process.stdin.destroy();
        }
    );
}
