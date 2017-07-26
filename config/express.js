const express = require('express');
const glob = require('glob');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');
const compress = require('compression');
const methodOverride = require('method-override');
const configJson = require('./config.json');

const init = (data, config) => {
  const env = configJson.NODE_ENV || 'development';

  const app = express();
   require('./auth')(app, data);

  app.locals.ENV = env;
  app.locals.ENV_DEVELOPMENT = env === 'development';

  app.set('views', config.root + '/app/views');
  app.set('view engine', 'jade');

  app.use(favicon(config.root + '/public/img/favicon.ico'));
  app.use(logger('dev'));
  app.use(bodyParser.text());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true,
  }));
  app.use(compress());
  app.use('/public', express.static(config.root + '/public'));
  app.use('/libs', express.static(config.root + '/node_modules'));
  app.use(methodOverride());

  const routers = glob.sync(config.root + '/app/routers/*.router.js');
  routers.forEach((router) => {
    require(router).attachTo(app, data);
  });

  app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  if (app.get('env') === 'development') {
    app.use((err, req, res, next) => {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err,
        title: 'error',
      });
    });
  }

  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: {},
      title: 'error',
    });
  });

  return Promise.resolve(app);
};

module.exports = { init };
