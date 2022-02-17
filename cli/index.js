const managerWorker = require('../workers/manager');

//loading huobi core and functions

const bt = require('../src/functions/huobi');

const UID = '5827722';
const APIKEY = '311b74fd-nbtycf4rw2-d1737fa4-9f0f4';
const APISECRET = '0e94c26f-b252c850-2d73cb85-b1e2c';

bt.init({
    api:{
        account_id:UID,
        key:APIKEY,
        secret:APISECRET
    },
    filters: {
        only_btc: false,
        only_usdt: true
    }
});


myData.set('debug', false);
myData.set('config:percentProfit', 0.4);
myData.set('config:occurrences', 10);
myData.set('config:confirmations', 3);

managerWorker.start( bt );