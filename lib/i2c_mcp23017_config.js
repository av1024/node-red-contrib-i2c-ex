// mcp23017 chip/config node
// requirements: i2cBus config node
module.exports = function(RED) {

  const API_URL_MCP23017 = "/i2c-mcp23017/pins/:chip"; 

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
      this.usedBits   = 0x0000; // for GUI/editor
  
      this.trace(" i2c-mcp23017 0x" + this.addr.toString(16) + ", at /dev/i2c-" + this.bus.bus);
      // common get-or-open on config node
      this.port = this.bus.openBus(this, undefined);
  
      var n = this;
  
      n.reconfig = (full) => {
        // if full -> force re-setup all parameters
        n.trace((full?"FULL ": "") +"reconfig");
      }
  
      n.reconfig(true);
  
      // return array of bit numbers free to assignment
      n.getFreeBits = () => {
        var bb = n.usedBits; //(n.inBits | n.outBits) & 0xFFFF;
        var ar = [];
        for(var i=0;i<16;i++) {
          if (!(bb & 0x0001)) ar.push(i);
          bb = bb >> 1;
        }
        //n.trace("::getFreeBits=" + ar);
        return ar;
      }

      /// Set direction bits (no hardware update)
      n.setBit = (bit, output) => {
        const b = parseInt(bit);
        if (isNaN(b) || b < 0 || b > 15) {
          n.warn("Invalid bit #" + bit);
          return false;
        }
        if (!n.getFreeBits().includes(b)) {
          n.warn("The bit #" + b + " already in use. ");
          return false;
        };
        const bb = 0x1 << b;
        n.usedBits |= bb;
        if (output) {
          n.outBits |= bb;
          n.pullupBits &= (~bb) & 0xFFFF;
          n.irqBits &= (~bb) & 0xFFFF;
          n.invertBits &= (~bb) & 0xFFFF;
        } else {
          n.inBits |= bb;
        }
        return true;
      }

      /// Clear direction/config bits (no hardware update)
      n.clearBit = (bit, clear_setup) => {
        const b = parseInt(bit);
        if (isNaN(b) || b < 0 || b > 15) {
          n.warn("Invalid bit #" + bit);
          return false;
        }
        if (n.getFreeBits().includes(b)) {
          // may be called if 'chip' node deleted/stopped before 'pin' node
          n.trace("Try to unregister not registered bit #" + b);
        }
        const bb = (~(0x1 << b)) & 0xFFFF;
        n.inBits &= bb;
        n.outBits &= bb;
        n.usedBits &= bb;
        if (clear_setup) {
            n.pullupBits &= bb;
            n.irqBits &= bb;
            n.invertBits &= bb;
        }
        return true;
      }
  
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
        n.setBit(bit, output);

        //TODO: re-configure chip GPIO
        n.trace("registered bit #" + bit + " IN: 0x" + n.inBits.toString(16) + ", OUT: 0x" + n.outBits.toString(16));
        return true;
      }
  
      n.unregisterPin = (bit) => {
        n.trace("Unregister pin #" + bit + " of 0x" + n.addr.toString(16));
        n.clearBit(bit, true);
        //TODO: reconfigure chip GPIO
        return true;
      }
  
  
  
      n.on("close", () => {
        // reset chip config
        n.inBits = 0;
        n.outBits = 0;
        n.irqBits = 0;
        n.pullupBits = 0;
        n.invertBits = 0;
        n.usedBits = 0;
        n.reconfig();
  
        n.trace(" close bus /dev/i2c-" + n.bus.bus);
        try {
          if (n.port) n.port.closeSync();
        } catch(ex) {
          n.debug("Err on close i2c: " + ex);
        }
      });
    }

    RED.nodes.registerType("i2c-mcp23017-config", i2cMCP23017cfg);

    // ========= WEB helpers ==========
    RED.httpAdmin.get(API_URL_MCP23017, (req, res) => {
      var chip = RED.nodes.getNode(req.params.chip);
      if (chip===null || chip===undefined) {
        RED.log.debug("GET free pins: chip not found for" + req.params.chip);
        res.sendStatus(404);
      } else {
        res.json({
          free: chip.getFreeBits(),
          inputs: chip.inBits,
          outputs: chip.outBits
        });
      }
    });

    RED.httpAdmin.post(API_URL_MCP23017, (req, res) => {
      // ajax post {setbit: <number>}

      RED.log.debug("POST params: " + JSON.stringify(req.params) + ", query: " + JSON.stringify(req.query) + ", body: " + JSON.stringify(req.body));
      var chip = RED.nodes.getNode(req.params.chip);
      if (chip===null || chip===undefined) {
        RED.log.debug("POST set bin: chip not found for" + req.params.chip);
        res.sendStatus(404);
      } else {
        var b = parseInt(req.body.setbit);
        if (b >= 0 && b <= 15) {
          chip.usedBits |= ((0x0001 << b) & 0xFFFF);
          res.sendStatus(200);
        } else {
          RED.log.debug("POST 'setbit' not passed.")
          res.sendStatus(404);
        }
      }
    });
}  