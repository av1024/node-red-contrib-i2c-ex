module.exports = function(RED) {

  // ===============================================
  //  i2cMCP23017Out
  // ===============================================

  function i2cMCP23017in(cfg) {
    RED.nodes.createNode(this, cfg);
    this.chip = RED.nodes.getNode(cfg.chip);
    this.bit = parseInt(cfg.bit);
    this.irq = cfg.irq===true;
    this.inv = cfg.invert===true;
    this.pup = cfg.pullup===true;

    this.output = false; // node direction flag for HTTP handler

    this.trace(" i2c-mcp23017 in 0x" + this.chip.addr.toString(16) + "#" + this.bit + ", at /dev/i2c-" + this.chip.bus.bus);    
    var n = this;
    
    n.ok = n.chip.registerPin(n.bit, false, n.pup, n.inv, n.irq, (msg)=>{
      n.trace("input callback. msg: " + JSON.stringify(msg));
      if (msg.payload) {
        n.status({fill:"green", shape: "dot", text: "ON"});
      } else {
        n.status({fill:"gray", shape: "dot", text: "OFF"});
      }
      n.send(msg);
    });

    if (n.ok) {
      n.status({fill:"gray", shape: "ring", text: "ready"});
    } else {
      n.status({fill:"red", shape: "ring", text: "pin busy"});
    }

    n.on("input", (msg) => {
      n.trace("input: " + JSON.stringify(msg));
      n.chip.readIn(true, n.bit);
    });

    n.on("close", () => {
      n.chip.unregisterPin(n.bit);
    });

  } // node
  RED.nodes.registerType("i2c-mcp23017 in", i2cMCP23017in);
}