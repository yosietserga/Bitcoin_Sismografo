const App = {};
App.lib = {};

//constants config file 
App.vars = require('../config/index.js');

//require node modules
App.lib.express = require('express');
App.lib.compression = require('compression');
App.lib.glob = require('glob');
App.lib.path = require('path');
App.lib.morgan = require('morgan');
App.lib.mongoose = require('mongoose');
App.lib.react = require('react');
App.lib.reactDom = require('react-dom');

//init global objects
App.server = App.lib.express();
App.Router = App.lib.express.Router;
App.router = App.Router({mergeParams: true});
App.log = console.log;
App.r = App.lib.react;
App.dom = App.lib.reactDom;
App.render = App.lib.react.render;

        
App.loader = (__path, __type, moduleName) => {
    App.lib.glob
    .sync('**/*.js', { cwd: __path })
    .map(filename => { 
        try {
            if (filename.replace('.js', '') == moduleName) {
                if (!App[`${__type}`]) App[`${__type}`] = {};
                App[`${__type}`][`${moduleName}`] = require(`${__path}/${filename}`);
            }
        } catch(err) {
            App.log(err);
        }
    })
}

App.load = (type, moduleName) => {
    if (type) App.loader(App.vars[`DIR_${type.toUpperCase()}`], type.toLowerCase(), moduleName);
}

module.exports = App;