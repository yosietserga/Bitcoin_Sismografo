const App = require('./src/startup');
const bodyParser = require('body-parser')

//settings
App.server.set('port', process.env.PORT || 3000);
App.server.set('views', App.vars.DIR_APP_VIEWS);

//middleware
App.server.use(App.lib.compression());
App.server.use(App.lib.morgan('dev'));
App.server.use(App.lib.express.json());
App.server.use(App.lib.express.static( App.vars.DIR_PUBLIC ));

//database
App.lib.mongoose.connect('mongodb://127.0.0.1/bot-trader', {useNewUrlParser: true})
.then(db => App.log('DB connected'))
.catch(err => log(err));

//routes

 
const apiRoutes = require(App.lib.path.join(App.vars.DIR_ROUTES, 'auto_router.js'))()
App.server
.use(bodyParser.urlencoded({ extended: true }))
.use(bodyParser.json())
.use((req, res, next) => {
    req.base = `${req.protocol}://${req.get('host')}`
    req.logger = App.log
    //req.db = database
    return next()
})
.use('/', apiRoutes)
.use((error, req, res, next) => {
    App.log(req, 'raw')
    App.log(error, 'error')
    res.status(error.status || 500).json({ error })
})
//App.server.use('/', require('./routes/index'))

//init 
App.server.listen(App.server.get('port'), () => {
	App.log(`Server has started on port ${App.server.get('port')}`);
	App.log(`You can now go to http://127.0.0.1:${App.server.get('port')}`);
});
