const chalk = require('chalk'); // cli styling
const notifier = require('node-notifier'); //show bubble notifications 


function generateId() {
    return Math.floor((Math.random() * 1000000) + 1);
}

function empty(mixedVar) {
    //  discuss at: http://locutus.io/php/empty/
    // original by: Philippe Baumann
    //    input by: Onno Marsman (https://twitter.com/onnomarsman)
    //    input by: LH
    //    input by: Stoyan Kyosev (http://www.svest.org/)
    // bugfixed by: Kevin van Zonneveld (http://kvz.io)
    // improved by: Onno Marsman (https://twitter.com/onnomarsman)
    // improved by: Francesco
    // improved by: Marc Jansen
    // improved by: Rafał Kukawski (http://blog.kukawski.pl)
    //   example 1: empty(null)
    //   returns 1: true
    //   example 2: empty(undefined)
    //   returns 2: true
    //   example 3: empty([])
    //   returns 3: true
    //   example 4: empty({})
    //   returns 4: true
    //   example 5: empty({'aFunc' : function () { alert('humpty'); } })
    //   returns 5: false

    var undef
    var key
    var i
    var len
    var emptyValues = [undef, null, false, 0, '', '0']

    for (i = 0, len = emptyValues.length; i < len; i++) {
        if (mixedVar === emptyValues[i]) {
            return true
        }
    }

    if (typeof mixedVar === 'object') {
        for (key in mixedVar) {
            if (mixedVar.hasOwnProperty(key)) {
                return false
            }
        }
        return true
    }

    return false
}

function isset() {
    //  discuss at: http://locutus.io/php/isset/
    // original by: Kevin van Zonneveld (http://kvz.io)
    // improved by: FremyCompany
    // improved by: Onno Marsman (https://twitter.com/onnomarsman)
    // improved by: Rafał Kukawski (http://blog.kukawski.pl)
    //   example 1: isset( undefined, true)
    //   returns 1: false
    //   example 2: isset( 'Kevin van Zonneveld' )
    //   returns 2: true

    var a = arguments
    var l = a.length
    var i = 0
    var undef

    if (l === 0) {
        throw new Error('Empty isset')
    }

    while (i !== l) {
        if (a[i] === undef || a[i] === null) {
            return false
        }
        i++
    }

    return true
}

function rtrim(str, charlist) {
    //  discuss at: http://locutus.io/php/rtrim/
    // original by: Kevin van Zonneveld (http://kvz.io)
    //    input by: Erkekjetter
    //    input by: rem
    // improved by: Kevin van Zonneveld (http://kvz.io)
    // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
    // bugfixed by: Brett Zamir (http://brett-zamir.me)
    //   example 1: rtrim('    Kevin van Zonneveld    ')
    //   returns 1: '    Kevin van Zonneveld'

    charlist = !charlist ? ' \\s\u00A0' : (charlist + '')
        .replace(/([[\]().?/*{}+$^:])/g, '\\$1')

    var re = new RegExp('[' + charlist + ']+$', 'g')

    return (str + '').replace(re, '')
}

function isInt(n) {
    return Number(n) === n && n % 1 === 0;
}

function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
}

function getFloat(num) {
    if (empty(num)) return 0;
    if (typeof num == 'string' && num.find(',')) num = num.replace(',', '');
    return parseFloat(num);
}

String.prototype.find = function(chr) {
    return this.indexOf(chr) == -1 ? false : true;
}

String.prototype.hash = function() {
    var hash = 0;
    if (this.length == 0) {
        return hash;
    }
    for (var i = 0; i < this.length; i++) {
        var char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

Number.prototype.countDecimals = function() {
    if (Math.floor(this.valueOf()) === this.valueOf() || isInt(this.valueOf())) return 0;
    return this.toString().split(".")[1].length || 0;
}

Number.prototype.toFix = function(n) {
    return parseFloat(this.toString().substring(0, (this.toString().indexOf(".") + n)));
}

Array.prototype.unique = function() {
  return this.filter(function (value, index, self) { 
    return self.indexOf(value) === index;
  });
}

Object.defineProperty(global, '__stack', {
	get: function() {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function(_, stack) {
            return stack;
        };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

//prototyping to get line number from caller stack
Object.defineProperty(global, '__line', {
	get: function() {
        return __stack[2].getLineNumber();
    }
});

//prototyping to get function name from caller stack
Object.defineProperty(global, '__function', {
	get: function() {
        return __stack[2].getFunctionName() || __stack[2].getMethodName();
    }
});

//prototyping to get file name from caller stack
Object.defineProperty(global, '__file', {
	get: function() {
        return __stack[2].getFileName();
    }
});

//logging with filename, linenumber and colors to a better syntax info
function log(msg, level, __index) {
	let x = {};
	if (parseInt(__index) > 0) {
		x.__file = __stack[__index].getFileName();
		x.__line = __stack[__index].getLineNumber();
		x.__function = __stack[__index].getFunctionName() || __stack[__index].getMethodName();
	} else {
		x.__file = __file;
		x.__line = __line;
		x.__function = __function;
	}
	let separator = __dirname.indexOf('/') == -1 ? '\\' : '/';
	let basedir = __dirname.replace('src', '');
	let file = x.__file.replace(basedir, '.'+ separator);
	let lvl = (level=='error') ? chalk.bgRed.bold('  ERROR  ') : (level=='warning') ? chalk.bgKeyword('orange')('  WARNING  ') : '';

    if (level == 'raw') 
    	console.log(msg);
    else if (typeof msg == 'object') {
    	console.log(`${lvl}${chalk.bgGreen('  '+ file +':'+ x.__line +'  ')}${chalk.bgCyan('  fn:'+ x.__function +'  ')} `);
    	console.log(msg);
    } else 
    	console.log(`${lvl}${chalk.bgGreen('  '+ file +':'+ x.__line +'  ')}${chalk.bgCyan('  fn:'+ x.__function +'  ')} ${chalk.keyword('orange')(`${msg}`)} `);
}

function notify(title, msg) {
    notifier.notify({
        title: title,
        message: msg
    });
}

function roundStep(qty, stepSize) {
    // Integers do not require rounding
    if (Number.isInteger(qty)) return qty;
    const qtyString = qty.toFixed(16);
    const desiredDecimals = Math.max(stepSize.indexOf('1') - 1, 0);
    const decimalIndex = qtyString.indexOf('.');
    return parseFloat(qtyString.slice(0, decimalIndex + desiredDecimals + 1));
}

module.exports = {
    generateId,
    empty,
    isset,
    rtrim,
    isInt,
    isFloat,
    getFloat,
    roundStep,
    notify,
    log
}