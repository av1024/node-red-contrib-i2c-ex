// mcp23017 chip/config node
// requirements: i2cBus config node
module.exports = function(RED) {
  

  
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

    // ========= admin endpoint ==========
  // a) lookup available pins
  // b) update node's free bis only on edit (w/o hardware re-init)

  /// Get list of unused bits for in/out node for 'oneditprepare'
  /*
  RED.httpAdmin.get(API_URL_MCP23017, (req, res) => {
    
    const nn = RED.nodes.getNode(req.params.nodeid); // in or out node
    var cf = nn.chip; // config node

    if (!cf && req.query.chip) {
      // edit non-deployed node, nn == null
      cf = RED.nodes.getNode(req.query.chip);
    }
    
    if (cf) {
      var fb = cf.getFreeBits();
      if (parseInt(nn.bit) >= 0) { // add current bit
        fb.push(nn.bit);
        fb.sort((a,b)=>{return parseInt(a)-parseInt(b)});
      }
      res.json({
        result: true,
        freeBits: fb,
        msg: "ok"
        });
    } else {
      res.json({
        result: false,
        msg: "Config node not set",
        freeBits: []
      });
    }
  });
  */

  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!11
  // DOES NOT WORK
  // EDITED/NOT DEPLOYED NODE EXIST ONLY IN GUI
  /// Update bitmask only of free bits for 'oneditsave'
  /*
  RED.httpAdmin.post(API_URL_MCP23017, (req, res) => {
    const nn = RED.nodes.getNode(req.params.nodeid); // in or out node
    const newbit = parseInt(req.body.bit);
    const cf = nn.chip; // config node
    var util = require('util')

    console.log("POST: " + util.inspect(req, false, 2, true));

    if (!cf) {
      res.status(404).send("Bad/not set config node");
      return;
    }
    if (nn.bit == newbit) {
      res.send("Not changed");
      return;
    }
    if (newbit >= 0 && newbit < 16) {
      if (cf.clearBit(nn.bit)) {
        nn.bit = null;
        if (cf.setBit(newbit)) {
         n.bit = newbit;
        } else {
          res.status(500).send("Failed to set new pin");
          return;
        }
      } else {
        res.status(500).send("Failed to clear old pin");
        return;
      }
    } else {
      res.status(400).send("Invlaid pin value");
      return;
    }
    console.log("Pin changed.");
    res.send("ok");
  });
*/


  // registration
  RED.nodes.registerType("i2c-mcp23017-chip", i2cMCP23017chip);
}

/** TODO
 * split sources
 * add post handler (change pins w/o chip reconfig) + jsonPOST ??
 * add oneditsave/etc
 * input node
 * node status/out redesign styles

 */

