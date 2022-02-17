const path = require('path');

const basePath = path.join(__dirname, '../');

const appPath = path.join(basePath, 'app');
const cli = path.join(basePath, 'cli');
const cfg = path.join(basePath, 'config');
const public = path.join(basePath, 'public');
const srcPath = path.join(basePath, 'src');

module.exports = {
	'DIR_MAIN': basePath,
	'DIR_APP': appPath,
	'DIR_CLI': cli,
	'DIR_CONFIG': cfg,
	'DIR_PUBLIC': public,
	'DIR_SRC': srcPath,

	//src paths
	'DIR_CONTROLLERS': path.join(srcPath, 'controllers'),
	'DIR_SERVICES': path.join(srcPath, 'services'),
	'DIR_FUNCTIONS': path.join(srcPath, 'functions'),
	'DIR_ROUTES': path.join(srcPath, 'routes'),

	//app paths
	'DIR_APP_VIEWS': path.join(appPath, 'views'),

	//common paths
	'DIR_PUBLIC': public
};