// re-implementation node-contrib-i2c with configurable i2c bus

module.exports = function(RED) {
  "use strict"
  var I2C = require("i2c-bus");

 // == config node ==
  function i2cBus(cfg) {
    RED.nodes.createNode(this, cfg);
    this.bus = parseInt(cfg.bus) || 0;
    var nn = this;
    nn.openBus = (node, port) => {
      //nn.debug("  .openBus(" + node + ", " + port + ")...");
      if (port) {
          node.status({ fill:"green", shape:"dot", text:"open"});
          return port;
      }
      let p = I2C.open(nn.bus, (err) => {
        if (err) {
          node.status({ fill:"red", shape:"ring", text:"err: "+err});
          return undefined;
        }
      });
      try {
        let fn = p.funcs || p.i2cFuncsSync();
        if (!fn.i2c) {
          node.status({ fill:"yellow", shape:"dot", text:"non-i2c dev"});
        } else {
          node.status({ fill:"green", shape:"dot", text:"open"});
        }
      } catch(ex) {
          node.warn("i2c open error: " + ex);
          //node.debug("exception: " + JSON.stringify(ex)); //FIXME: test
          node.status({ fill:"red", shape:"ring", text:""+ex});
          return undefined;
      }

      return p;
    }
  }

  // registration
  RED.nodes.registerType("i2c-bus-config", i2cBus);

}
