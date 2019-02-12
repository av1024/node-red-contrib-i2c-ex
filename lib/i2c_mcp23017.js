// mcp23017 chip/config node
// requirements: i2cBus config node
module.exports = function(RED) {

  // ===============================================
  //  i2cMCP23017cfg
  // ===============================================

  function i2cMCP23017cfg(cfg) {
    RED.nodes.createNode(this, cfg);
    this.bus = RED.nodes.getNode(cfg.bus);
    this.addr = parseInt(cfg.addr) || 0x20;
    this.joinIRQ = (cfg.joinIRQ==true) || false; // join A/B irq outputs
    this.irqOD = (cfg.irqOD==true) || false; // IRQ pin setup: true - OpenDrain, false: Rail-2-Rail

    this.inBits     = 0x0000;
    this.outBits    = 0x0000;
    this.pullupBits = 0x0000;
    this.invertBits = 0x0000;
    this.irqBits    = 0x0000;

    this.trace(" i2c-mcp23017 0x" + this.addr.toString(16) + ", at /dev/i2c-" + this.bus.bus);
    // common get-or-open on config node
    this.port = this.bus.openBus(this, undefined);

    var n = this;

    /**
     *  configure pi i/o:
     *  - bit:    [0..15]
     *  - output: true/false - direction
     *  - pullup: true/false - use pullup on input
     *  - invert: true/false - invert flag for input
     *  - irq:    true/false - use IRQ for input
     *
     *  returns: true on success, false if bit is busy
     */
    n.registerPin = function(bit, output, pullup, invert, irq) {
      // true if pin not in inBits
      const b = parseInt(bit);
      if (isNaN(b) || b < 0 || b > 15) {
        n.warn("Invalid bit #" + bit);
        return false;
      }
      return true;
    }

    n.unregisterPin = function(bit) {
      n.trace("Unregister pin #" + bit + " of " + n.addr.toString(16));
    }

    n.reconfig = function() {
      n.trace("reconfig");
    }

    n.on("close", () => {
      n.trace(" close bus /dev/i2c-" + n.bus.bus);
      try {
        if (n.port) n.port.closeSync();
      } catch(ex) {
        n.info("Err on close i2c: " + ex);
      }
    });
  }

  // ===============================================
  //  i2cMCP23017chip
  // ===============================================

  function i2cMCP23017chip(cfg) {
    RED.nodes.createNode(this, cfg);
    this.chip = RED.nodes.getNode(cfg.chip);

    var n = this;

    n.on("input", (msg) => {
      n.trace("input: " + JSON.stringify(msg));
    });
  }

  // ===============================================
  //  i2cMCP23017Out
  // ===============================================

  function i2cMCP23017out(cfg) {
    RED.nodes.createNode(this, cfg);
    this.chip = RED.nodes.getNode(cfg.chip);
    this.bit = parseInt(cfg.bit);

    this.trace(" i2c-mcp23017 out 0x" + this.chip.addr.toString(16) + "#" + this.bit + ", at /dev/i2c-" + this.bus.bus);
    // common get-or-open on config node
    //this.port = this.bus.openBus(this, undefined);

    var n = this;
    n.ok = n.chip.registerPin(n.bit, true);


    n.on("input", (msg) => {
      n.trace("input: " + JSON.stringify(msg));
    });

    n.on("close", () => {
      n.unregisterPin(this.bit);
      /*n.trace(" close bus /dev/i2c-" + n.bus.bus);
      try {
        if (n.port) n.port.closeSync();
      } catch(ex) {
        n.info("Err on close i2c: " + ex);
      }
      */
    });

    //TODO: unregisterPin
  }


  // registration
  RED.nodes.registerType("i2c-mcp23017-config", i2cMCP23017cfg);
  RED.nodes.registerType("i2c-mcp23017-chip", i2cMCP23017chip);
  RED.nodes.registerType("i2c-mcp23017 out", i2cMCP23017out);
}
