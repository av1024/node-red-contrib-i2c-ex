// re-implementation node-contrib-i2c with configurable i2c bus
// raw i2c i/o modules

module.exports = function(RED) {
  "use strict"
  //var I2C = require("i2c-bus");

// == scan node ==
  function i2cScan(cfg) {
    RED.nodes.createNode(this, cfg);
    this.bus = RED.nodes.getNode(cfg.bus);
    this.arr = cfg.asarray || false;

    var n = this;

    // common get-or-open on config node
    n.port = n.bus.openBus(n, undefined);

    // input
    n.on("input", (msg) => {
        n.trace("Start scan, msg: " + msg);
        n.port = n.bus.openBus(n, n.port);

        if (n.port) {
          n.port.scan(function(err, devices) {
            if (err) {
              n.warn("ERR: " + err);
            } else {
              if (n.arr) {
                n.send({ payload: Array.isArray(devices)?devices:[devices]});
              } else {
                for(var i in devices) n.send({payload:devices[i]});
              }
            }
          });
        }
    });

    // close
    n.on('close', () => {
      n.trace("close bus /dev/i2c-" + n.bus.bus);
      try {
        if (n.port) n.port.closeSync();
      } catch(ex) {
        n.info("Err on close i2c: " + ex);
      }
    });
  }

// == read node ==
  function i2cRead(cfg) {
    RED.nodes.createNode(this, cfg);
    this.bus = RED.nodes.getNode(cfg.bus);
    this.addr = parseInt(cfg.addr);
    this.cmd = parseInt(cfg.cmd);
    this.count = parseInt(cfg.count);

    this.trace(" open I2C /dev/i2c-" + this.bus.bus);

    // common get-or-open on config node
    this.port = this.bus.openBus(this, undefined);

    var n = this;

    // input
    n.on("input", (msg) => {
      n.port = n.bus.openBus(n, n.port);
      if (!n.port) return;

      let addr = parseInt(msg.addr) || n.addr;
      var cmd = parseInt(msg.command);
      let cnt = parseInt(msg.count) || n.count;

      if (isNaN(addr)) {
        n.status({fill:"red", shape:"ring", text:"Bad address"});
        return;
      }
      if (isNaN(cmd)) {
        cmd = n.cmd;
        if (isNaN(cmd)) {
          n.status({fill:"red", shape:"ring", text:"Bad command"});
          return;
        }
      }
      if (isNaN(cnt)) {
        n.status({fill:"red", shape:"ring", text:"Bad size"});
        return;
      }

      var data = new Buffer(cnt);
      n.port.readI2cBlock(addr, cmd, cnt, data, function(err, size, res) {
        if (err) {
          n.error(err, msg);
          return null;
        } else {
          var pl;
          if (cnt == 1) {
            pl = res[0];
          } else {
            pl = res;
          }
          var m = Object.assign({}, msg);
          m.addr = addr;
          m.command = cmd;
          m.size = size;
          m.payload = pl;
          n.send(m);
        }
      });
    });

    // close
    n.on('close', () => {
      n.trace(" close bus /dev/i2c-" + n.bus.bus);
      try {
        if (n.port) n.port.closeSync();
      } catch(ex) {
        n.info("Err on close i2c: " + ex);
      }
    });
  }

// == write node ==
  function i2cWrite(cfg) {
    RED.nodes.createNode(this, cfg);
    this.bus = RED.nodes.getNode(cfg.bus);
    this.addr = parseInt(cfg.addr);
    this.cmd = parseInt(cfg.cmd);
    this.nsize = parseInt(cfg.nsize) || 1;
    this.trace(" open I2C /dev/i2c-" + this.bus.bus);

    // common get-or-open on config node
    this.port = this.bus.openBus(this, undefined);

    var n = this;
    n.on("input", (msg) => {
      // get/check i2c bus availability
      n.port = n.bus.openBus(n, n.port);
      if (!n.port) return;

      let addr = parseInt(msg.addr) || n.addr;
      var cmd = parseInt(msg.command);
      let nsize = parseInt(msg.nsize) || n.nsize;

      if (isNaN(addr)) {
        n.status({fill:"red", shape:"ring", text:"Bad address"});
        return;
      }
      if (isNaN(cmd)) {
        cmd = n.cmd;
        if (isNaN(cmd)) {
          n.status({fill:"red", shape:"ring", text:"Bad command"});
          return;
        }
      }
      if (nsize > 6) {
        n.status({fill:"red", shape:"ring", text:"Int ovesize (max 6)"});
        return;
      }

      var data;
      try {
        data = Buffer.from(msg.payload);
        if (data.length > 32) {
          n.status({fill:"red", shape:"ring", text:"Data ovesize (max 32)"});
          return;
        }
      } catch (ex) {
        var x = parseInt(msg.payload);
        if (!isNaN(x)) {
          data = Buffer.allocUnsafe(nsize);
          data.writeIntLE(x, 0, nsize);
        }
      }
      // - write - to - i2c -
      if (data) {
        n.port.writeI2cBlock(addr, cmd, data.length, data, function(err) {
            if (err) {
              n.error(err, msg);
            } else {
              n.send(msg);
            }
          });
      }
    }); // on input

    n.on('close', () => {
      n.trace(" close bus /dev/i2c-" + n.bus.bus);
      try {
        if (n.port) n.port.closeSync();
      } catch(ex) {
        n.info("Err on close i2c: " + ex);
      }
    });
  }

  // registration
  RED.nodes.registerType("i2c-scan", i2cScan);
  RED.nodes.registerType("i2c-write", i2cWrite);
  RED.nodes.registerType("i2c-read", i2cRead);
}
