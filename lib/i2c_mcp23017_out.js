module.exports = function(RED) {

  // ===============================================
  //  i2cMCP23017Out
  // ===============================================

  function i2cMCP23017out(cfg) {
    RED.nodes.createNode(this, cfg);
    this.chip = RED.nodes.getNode(cfg.chip);
    this.bit = parseInt(cfg.bit);
    this.output = true; // node direction flag for HTTP handler

    this.trace(" i2c-mcp23017 out 0x" + this.chip.addr.toString(16) + "#" + this.bit + ", at /dev/i2c-" + this.chip.bus.bus);
    //this.trace("chip.users: " + this.chip.users);
    // common get-or-open on config node
    //this.port = this.bus.openBus(this, undefined);

    var n = this;
    n.ok = n.chip.registerPin(n.bit, true);

    if (n.ok) {
      n.status({fill:"gray", shape: "ring", text: "ready"});
    } else {
      n.status({fill:"red", shape: "ring", text: "pin busy"});
    }


    n.on("input", (msg) => {
      n.trace("input: " + JSON.stringify(msg));
      const yy = ["on", "open", "yes", "true"];
      let x = msg.payload;
      if (parseInt(x) > 0 || x===true || yy.includes((""+x).toLowerCase())) {
        if (n.chip.setOut(n.bit, true))
          n.status({fill:"green", shape: "dot", text: "ON"});
        else
          n.status({fill:"red", shape: "dot", text: "ERR"});
      } else {
        if (n.chip.setOut(n.bit, false))
          n.status({fill:"gray", shape: "dot", text: "OFF"});
        else
          n.status({fill:"red", shape: "dot", text: "ERR"});
      }
    });

    n.on("close", () => {
      n.chip.unregisterPin(n.bit);
    });
  }

  RED.nodes.registerType("i2c-mcp23017 out", i2cMCP23017out);
}