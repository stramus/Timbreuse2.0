/**
 * Handle mathematics functions needed by the server.
 *
 * @module csv
 * @class csv
 */
const moment = require("moment");
const fs = require("fs");
const path = require('path');
const config = require("./config.js");
const fsextra = require('fs-extra');
const drivelist = require('drivelist');
const log = require("./log");
const json2csv = require('json2csv');
const async = require('async');
var knex = require('knex')({
    client: 'sqlite3',
    useNullAsDefault: true
});
module.exports = {
    /**
     * Write to a CSV the tag and tag-time provided
     * @method writeBruteLoggingToCSV
     * @param {String} tag the tag.
     * @param {String} time the tag-time.
     **/
    writeBruteLoggingToCSV: (tag, time) => {
        var filename;
        var dirname = path.join(__dirname, "..", "CSV");
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname);
        }
        if (global.config.csvFreq) {
            filename = moment().format("DD_MM_YYYY") + ".csv";
        } else {
            filename = "week_" + moment().week() + ".csv";
        }
        var npath = path.join(path.join(dirname, global.config.class + "_" + filename).toString());
        var fd;
        if (!fs.existsSync(npath)) {
            try {
                fd = fs.openSync(npath, "a");
                fs.writeSync(fd, "tag,time\n");
                fs.writeSync(fd, tag + "," + time + "\n");
                fs.closeSync(fd);
                return;
            } catch (err) {
                log.error("Can't write to the file, aborting...\n Filename : " + npath);
                return;
            }
        }
        try {
            fd = fs.openSync(npath, "a");
            fs.writeSync(fd, tag + "," + time + "\n");
            fs.closeSync(fd);
            return;
        } catch (err) {
            log.error("Can't write to the file, aborting...\n Filename : " + npath);
            return;
        }

    },
    /**
     * Export all the server's CSV to a USB key.
     * @method exportCSV
     * @param {Function} cb a callback that will be called when all the file has been copied to the USB key.
     **/
    exportCSV: (cb) => { //NOTE On linux execute "sudo chmod -R a+rwx ." to make it works
        log.info("Master key detected. Detecting USB drive...");
        drivelist.list((error, drives) => {
            if (error) {
                log.error("Error while detecting USB drive. Aborting...");
                return;
            }
            drives.forEach((drive) => {
                if (!drive.system && drives.mountpoints[0].path!="/boot") {
                    var remotefolder = path.join(drive.mountpoints[0].path, global.config.class + "_" + moment().format('MMMM_Do_YYYY__HH_mm_ss'));
                    log.info("Copying CSV to " + drive.description + " in path " + remotefolder.toString());
                    if (fs.existsSync(remotefolder)) {
                        log.error("The folder already exists. Aborting");
                        return;
                    } else {
                        fs.mkdirSync(remotefolder);
                    }
                    var localfolder = path.join(__dirname, "..", "CSV");
                    if (!fs.existsSync(localfolder)) {
                        fs.mkdirSync(localfolder);
                    }
                    var filelist = fs.readdirSync(localfolder);
                    for (var i = 0; i < filelist.length; i++) {
                        try {
                            log.info("Copying CSV file " + filelist[i]);
                            fsextra.copySync(path.join(localfolder, filelist[i]), path.join(remotefolder, filelist[i]));
                        } catch (err) {
                            log.error("Error copying CSV files : " + err);
                            return;
                        }
                    }
                    cb();
                }
            });
        });
    },
    exportDBtoCSV: (cb) => {
        var data = [];
        async.waterfall([
            function(callback) {
                global.db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
                    if (err)
                        callback(err, null);
                    for (var i = 0; i < rows.length; i++) {
                        data[i] = rows[i];
                        data[i].id = i;
                    }

                    callback(null, data);
                });
            },
            function(data, callback) {
                async.each(data, function(cur, callback2) {
                    global.db.all("pragma table_info(" + cur.name + ");", (err, rows) => {
                        data[cur.id].columns = [];
                        for (var i = 0; i < rows.length; i++) {
                            data[cur.id].columns[i] = rows[i].name;
                        }
                        callback2(err);
                    });
                }, function(err) {
                    if (err) {
                        log.error("Error happened during the database dump : " + err);
                        callback(err, null);
                    }
                    callback(null, data);
                });
            },
            function(data, callback) {

                async.each(data, function(cur, callback2) {
                    global.db.all(knex.select().from(cur.name).toString(), (err, rows) => {
                        data[cur.id].rows = rows;
                        callback2(err);

                    });
                }, function(err) {
                    if (err) {
                        log.error("Error happened during the database dump : " + err);
                        callback(err, data);
                    }
                    callback(null, data);
                });

            },
            function(data, callback) {
                var csv = [];
                async.each(data, function(cur, callback2) {
                    //console.log(cur.rows);
                    csv.push({
                        data: json2csv({
                            data: cur.rows,
                            fields: cur.columns
                        }),
                        name: cur.name
                    });
                    callback2(null);

                }, function() {
                    log.info("Master key detected. Detecting USB drive...");
                    drivelist.list((error, drives) => {
                        if (error) {
                            log.error("Error while detecting USB drive. Aborting...");
                            return;
                        }
                        drives.forEach((drive) => {
                            var remotefolder = "";
                            if (!drive.system) {
                              console.log(drive.mountpoints[0].path);
                                remotefolder = path.join(drive.mountpoints[0].path, "DB_DUMP___" + moment().format('MMMM_Do_YYYY__HH_mm_ss'));
                                log.info("Copying CSV to " + drive.description + " in path " + remotefolder.toString());
                                if (fs.existsSync(remotefolder)) {
                                    log.error("The folder already exists. Aborting");
                                    return;
                                } else {
                                    fs.mkdirSync(remotefolder);
                                }
                                for (var i = 0; i < csv.length; i++) {
                                    var filename = csv[i].name + ".csv";
                                    var fpath = path.join(remotefolder, filename);
                                    log.info("Writing data in " + fpath);
                                    fs.writeFileSync(fpath, csv[i].data);

                                }
                            }
                        });
                    });
                });

            }
        ], function(err, result) {
            if (err) {
                log.error("Error happened during the database dump : " + err);
            }
        });

    }
};
