/**
 * Handle client frontend.
 *
 * @module client
 * @class client
 */
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const url = require('url');
const net = require("net");
const request = require("../request.js");
const log = require("./../utils/log.js");
var currentCb = function(err, data) {}; //Proto
var currentBuf = "";
/**
 * Handle incoming request and treat them when the Timbreuse type is a client
 * @method clientServer
 * @param  {[type]}     data [description]
 * @return {[type]}          [description]
 */
function clientServer(data) {
  try {
    var ireq = JSON.parse(data);
  } catch (err) {
    return;
  }
  if (ireq.fnc != undefined) {
    switch (ireq.fnc) {
      case request.REQUEST.UPDATESTD:
        global.mwin.webContents.send("update", ireq.data); //Update data about a student
        break;
      case request.REQUEST.TOGGLENOTIFICATION:
        global.mwin.webContents.send("toggleNotification", ireq.data) //Change the status of a notification
        break;
      case request.REQUEST.UPDATENOTIF:
        if (!global.mwin.isFocused() || global.currentPage != global.PAGES.NOTIFICATIONS) { //Incomming notification
          var title;
          switch (ireq.data.type) {
            case global.LOGS.MINIMUMPAUSE:
              title = "Minimum pause";
              break;
            case global.LOGS.NOPAUSE:
              title = "No pause";
              break;
            case global.LOGS.NOLUNCH:
              title = "No lunch";
              break;
            case global.LOGS.TIMEERROR:
              title = "Time error";
              break;
            default:
              title = "ERROR";
          }
          log.info("Displaying notification");
          var iconPath = path.join(__dirname, "..", "graphics", "ico.png");
          global.tray.displayBalloon({
            icon: iconPath,
            title: title,
            content: ireq.data.message
          });
        }
        global.mwin.webContents.send("updateNotification", ireq.data)
        break;
      default:
        //Do nothing
    }
  }
}
/**
 * Check if packet is complet. If so, send it to clientServer function
 * @method dataExecuter
 * @param  {String}     data The current buffer
 */
function dataExecuter(data) {
  var index = currentBuf.indexOf("\0");
  if (index != -1) {
    var tmp = currentBuf.substring(0, index).toString("utf8");
    currentBuf = currentBuf.slice(index + 1);
    currentCb(null, tmp);
    clientServer(tmp);
    if (currentBuf.length > 0)
      dataExecuter(currentBuf);
  }
}
/**
 * Handle incomming data appending new data to current data buffer
 * @method incomingDataHandling
 * @param  {String}             data The incomming data
  */
function incomingDataHandling(data) {
  currentBuf += data;
  dataExecuter(currentBuf);
}
/**
 * Connect to the server
 * @method connect
 * @param  {Function} cb the callback function
 */
function connect(cb) {
  clientconn = new net.Socket();
  clientconn.once("error", (err) => { //On error display login
    if (global.currentPage != request.PAGES.LOGIN)
      global.mwin.loadURL(url.format({
        pathname: path.join(__dirname, 'web_frontend/pages/login.html'),
        protocol: 'file:',
        slashes: true
      }));
    global.clientconn = null;
    cb(err);
  });
  clientconn.once("close", () => { //On close, go to login
    if (global.currentPage != request.PAGES.LOGIN)
      global.mwin.loadURL(url.format({
        pathname: path.join(__dirname, 'web_frontend/pages/login.html'),
        protocol: 'file:',
        slashes: true
      }));

    global.clientconn = null;
  });
  clientconn.on("data", incomingDataHandling); //On data, send it to data compilation function
  clientconn.connect({ //Connect to server
    host: global.config.server,
    port: 703
  }, () => {
    global.clientconn = clientconn;
    cb(null);

  });
}
/**
 * End current connection to the server
 * @method disconnect
 */
function disconnect() {
  try {
    global.clientconn.destroy();
    global.clientconn = null;
  } catch (err) {
    log.error(err);
  }
}
/**
 * Send data to server
 * @method send
 * @param  {String}   data outgoing data
 * @param  {Function} cb   The callback to callback
 */
function send(data, cb) {
  currentCb = cb;
  global.clientconn.removeAllListeners("error");
  global.clientconn.on("error", (err) => {
    currentCb(err);
  });
  global.clientconn.write(data + "\0");
}
/**
 * Create a windows for the client
 * @method createWindow
 *
 **/
function createWindow() {
  global.mwin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntergrationInWorker: true
    }

  });
  global.mwin.loadURL(url.format({
    pathname: path.join(__dirname, 'web_frontend/pages/login.html'),
    protocol: 'file:',
    slashes: true
  }));
  if (global.DEBUG)
    global.mwin.webContents.openDevTools();
  global.mwin.on('closed', function() { //On closed, quit
    mainWindow = null;
  });
  global.mwin.on("ready-to-show", () => { //Wait for html before showing
    global.mwin.show();
  });

  var iconPath = path.join(__dirname, "..", "graphics", "ico.png");
  global.tray = new electron.Tray(iconPath);
  var showVisible = () => {
    global.mwin.isVisible() ? global.mwin.hide() : global.mwin.show();
  };
  global.tray.on('click', showVisible);
  global.tray.on('double-click', showVisible);
  global.tray.on('balloon-click', showVisible);
  global.mwin.on('show', () => {
    global.tray.setHighlightMode('always')
  });
  global.mwin.on('hide', () => {
    global.tray.setHighlightMode('never')
  });

}
/**
 * Load the client interface
 * @method load
 **/
function load() {
  global.clientconn = null;


  app.on('ready', createWindow);
  app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  app.on('activate', function() {
    if (global.mwin === null) {
      createWindow();
    }
  });
}


module.exports = {
  load,
  connect,
  disconnect,
  send
};
