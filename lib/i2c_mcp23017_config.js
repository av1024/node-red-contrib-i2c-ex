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
      this.joinIRQ = (cfg.joinirq==true) || false; // join A/B irq outputs
      this.irqOD = (cfg.irqod==true) || false; // IRQ pin setup: true - OpenDrain, false: Rail-2-Rail
      this.bufferOut = parseInt(cfg.bufferout) || 0;
  
      this.inBits     = 0x0000;
      this.outBits    = 0x0000;
      this.usedBits   = 0x0000; // for GUI/editor

      // hw bitmasks
      this.pullupBits = 0x0000;
      this.invertBits = 0x0000;
      this.irqBits    = 0x0000;
      this.outValue   = 0x0000; // bitmask to be send to hardware
      this.inValue    = 0x0000; // last read inputs 

      this.bufTimer = null;
      this.read_cbs = {}; // read node callbacks here
  
      this.trace(" i2c-mcp23017 0x" + this.addr.toString(16) + ", at /dev/i2c-" + this.bus.bus);
      // common get-or-open on config node
      this.port = this.bus.openBus(this, undefined);
  
      var n = this;
  
      n.reconfig = (full) => {
        // if full -> force re-setup all parameters
        n.trace((full?"FULL ": "") +"reconfig");
        n.port = n.bus.openBus(n, n.port);
        if (!n.port) return;

        // async
        setImmediate(()=>{
          if (full) {
            // set irq out mode

            var bbb = 0;
            if (n.joinIRQ) bbb |= 0x40; // IOCON.MIRROR bit
            if (n.irqOD) bbb |= 0x04; // IOCON.IRQ OpenDrain
            bbb |= 0x02; // IOCON.INTPOL active-high
            //NB! may turn off some outputs. Don't call full reconfig on pin changes
            n.port.writeI2cBlockSync(n.addr, 0x05, 1, Buffer([0]));  // reset IOCON.BANK in "1" mode  --> switch to "0" mode, reset rq if in "0" mode
            n.port.writeI2cBlockSync(n.addr, 0x0A, 1, Buffer([bbb]));  // reset IOCON.BANK in "0" mode
          }
          
          //FIXME: Test A/B port byte order
          
          //n.port.writeI2cBlockSync(n.addr, 
          // set in/out mode
          // set inverts
          // set pinirq mode
          n.port.writeI2cBlockSync(n.addr, 0x00, 10, Buffer([
            n.inBits&0xFF, n.inBits>>8,  //IODIR A/B
            n.invertBits&0xFF, n.invertBits>>8, // IOPOL A/B
            n.irqBits&0xFF, n.irqBits>>8,  // INTEN A/B
            0, 0, // DEFVAL (unused)
            0, 0 // INTCON: compare with prev value
          ])); // 0, 1
          
          // set pullups
          n.port.writeI2cBlockSync(n.addr, 0x0C, 2, Buffer([
            n.pullupBits&0xFF, n.pullupBits>>8,  // GPPU A/B
          ]));
        }, null);

        return true;
      }
    
  
      n.reconfig(true);
  
      /// return array of bit numbers free to assignment
      n.getFreeBits = () => {
        var bb = n.usedBits;
        var ar = [];
        for(var i=0;i<16;i++) {
          if (!(bb & 0x0001)) ar.push(i);
          bb = bb >> 1;
        }
        return ar;
      }

      /// check bit number for 0..15
      n.isValidBit = (bit) => {
        if (isNaN(bit) || bit < 0 || bit > 15) {
          n.warn("Invalid bit #" + bit);
          return false;
        }
        return true;
      }

      /// Set direction bits (no hardware update)
      n.setBit = (bit, output) => {
        const b = parseInt(bit);
        if (!n.isValidBit(b)) return false;

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
        if (!n.isValidBit(b)) return false;
        
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

      /// send bitmask to hardware
      n.writeOut = () => {
        if (n.bufTimer) {
          //n.trace("Buffer OUTPUTS to 0x" + n.addr.toString(16));
          return true;
        }
        if (n.bufferOut) {
          n.bufTimer = setTimeout(()=>{
            //n.trace("Write Buffered OUTPUTS to 0x" + n.addr.toString(16));
            n.bufTimer = null;
            n.port.writeI2cBlockSync(n.addr, 0x14, 2, Buffer([n.outValue & 0xFF, n.outValue>>8]));
          }, n.bufferOut);
        } else {
          setImmediate(()=>{
            n.trace("Write OUTPUTS to 0x" + n.addr.toString(16));
            n.port.writeI2cBlockSync(n.addr, 0x14, 2, Buffer([n.outValue & 0xFF, n.outValue>>8]));
          }, null);
        }
       return true;
      }

      /// Set output bit value
      /// if `dont_update` set, only status bits updated
      n.setOut = (bit, value, dont_update) => {
        const b = parseInt(bit);
        if (!n.isValidBit(b)) return false;
        const bb = 0x0001 << b;
        if (!(n.outBits & bb)) {
          n.warn("Try to write to non-outnput bit #" + b);
          return false;
        }
        if (value===true || parseInt(value)>0 || ["on", "yes", "true", "open"].includes((""+value).toLowerCase())) {
          n.outValue |= bb;
          //n.trace("Turn ON bit #" + b + " of 0x" + this.addr.toString(16));
        } else {
          n.outValue &= (~bb) & 0xFFFF;
          //n.trace("Turn OFF bit #" + b + " of 0x" + this.addr.toString(16));
        }
        if (!dont_update) return n.writeOut();

        return true;
      }

      /// read current input pins and call InputNode callback if pin changed
      // callback function got single argument (msg)
      n.readIn = (force, only_bit) => {

        if (!n.port) {
          //error: port no open
          n.trace("ReadIn: port not set");
          return false;
        }

        var iqv = n.port.readWordSync(n.addr, 0x0E); // INTFA,B
        var v = n.port.readWordSync(n.addr, 0x12); // GPIOA,B 
        //TESTME: ??? read INTCAP on IRQ as reference ???

        v &= n.inBits; // mask inputs only

        var chg = n.inValue ^ v; // changed

        //n.trace("readIn("+force+","+only_bit+"): raw in=0x" + v.toString(16) + ", chg=0x" + chg.toString(16));
        for(var i=0;i<16;i++) {
          let b = 0x0001 << i;
          let msg = {
                      topic: "",
                      payload: v & b ? 1 : 0,
                      irq: iqv & b ? 1 : 0,
                      poll: force ? 1 : 0,
                      pin: i,
                      addr: n.addr
                    };
          let cb = n.read_cbs[i];
          //if (cb) {
          //  n.trace("non-null callback for #"+i+": " + cb + "\nforce: "+force+", b&chg: " + (b&chg) +", only_bit: " + only_bit);
          //}
          if ((b & chg || b & iqv)
              || (force && isNaN(only_bit))
              || (force && only_bit==i)
             )
          {
            //n.trace("invoke callback #" + i);
            if (typeof cb === "function") cb(msg);
          }
        }
        n.inValue = v;
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
      n.registerPin = function(bit, output, pullup, invert, irq, read_cb) {
        // true if pin not in inBits
        var r = n.setBit(bit, output);
        
        if (r) {
          let b = 0x0001 << parseInt(bit);
          if (!output) {
            if (pullup) n.pullupBits |= b; else n.pullupBits &= ~b;
            if (invert) n.invertBits |= b; else n.invertBits &= ~b;
            if (irq) n.irqBits |= b; else n.irqBits &= ~b;
            if (typeof read_cb === "function") {
              //n.trace("Set callback for #" + bit + " to " + read_cb);
              n.read_cbs[parseInt(bit)] = read_cb;
            }
          } else {
            n.read_cbs[parseInt(bit)] = null;
          }
        }

        n.reconfig(false);
        n.trace("registered bit #" + bit + " IN: 0x" + n.inBits.toString(16) + ", OUT: 0x" + n.outBits.toString(16));
        return r;
      }
  
      n.unregisterPin = (bit) => {
        n.trace("Unregister pin #" + bit + " of 0x" + n.addr.toString(16));
        n.clearBit(bit, true);
        n.read_cbs[parseInt(bit)] = null;
        n.reconfig(false);
        return true;
      }
  
      n.on("close", () => {
        // reset chip config
        n.inBits = 0xFFFF;
        n.outBits = 0;
        n.irqBits = 0;
        n.pullupBits = 0;
        n.invertBits = 0;
        n.usedBits = 0;
        n.read_cbs = {};
        if (n.bufTimer) {
          clearTimeout(n.bufTimer);
          n.bufTimer = null;
        }
        n.reconfig(true);
        
  
        n.trace(" close bus /dev/i2c-" + n.bus.bus);
        try {
          if (n.port) n.port.closeSync();
          n.port = null;
        } catch(ex) {
          n.debug("Err on close i2c: " + ex);
        }
      });
    }

    RED.nodes.registerType("i2c-mcp23017-config", i2cMCP23017cfg);
}  