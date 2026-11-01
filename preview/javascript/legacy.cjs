'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const EXPORT_DIR = path.join(__dirname, '..', 'exports');
const CSV_HEADER = 'id,number,total,status\n';

/**
 * Writes orders to a CSV file, node-style callback API.
 * @param {Array<{id: number, number: string, total: number, status: string}>} orders
 * @param {(err: Error|null, file?: string) => void} callback
 */
function exportOrders(orders, callback) {
  const file = path.join(EXPORT_DIR, 'orders-' + Date.now() + '.csv');
  const body = orders
    .map(function (o) {
      var safe = String(o.number).replace(/"/g, '""');
      return [o.id, '"' + safe + '"', o.total.toFixed(2), o.status].join(',');
    })
    .join('\n');

  fs.mkdir(EXPORT_DIR, { recursive: true }, function (mkErr) {
    if (mkErr) return callback(mkErr);
    fs.writeFile(file, CSV_HEADER + body, 'utf8', function (err) {
      if (err) return callback(err);
      callback(null, file);
    });
  });
}

function OrderWatcher(intervalMs) {
  EventEmitter.call(this);
  this.intervalMs = intervalMs || 30000;
  this.timer = null;
}

OrderWatcher.prototype = Object.create(EventEmitter.prototype);
OrderWatcher.prototype.constructor = OrderWatcher;

OrderWatcher.prototype.start = function () {
  var self = this;
  // TODO: replace polling with a database change stream
  this.timer = setInterval(function () {
    self.emit('tick', { at: new Date().toISOString(), pending: 0 });
  }, this.intervalMs);
  return this;
};

OrderWatcher.prototype.stop = function () {
  clearInterval(this.timer);
  this.timer = null;
};

module.exports = {
  exportOrders: exportOrders,
  OrderWatcher: OrderWatcher,
  version: require('./package.json').version,
};

if (require.main === module) {
  exportOrders([{ id: 1, number: 'ORD-0001', total: 42.5, status: 'paid' }], function (err, f) {
    console.log(err ? 'Export failed: ' + err.message : 'Wrote ' + f);
  });
}
