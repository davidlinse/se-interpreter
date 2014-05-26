/**
  A se-interpreter listener that reports test results in junit-xml format.

  Example usage:
  node interpreter.js --browser-browserName=firefox \
                      --listener ./reporter/junit-reporter.js \
                      --listener-path ./reports/result.xml \
                      examples/tests/get.json

  Uses the value of "testRun.browserOptions.browserName" as "package" value.

  You can also use --listener-silent=true to prevent the default listener
  output from happening, just like the --silent command.

  author:  david linse
  version: 0.1.6

  TODO: add stderr to to testsuite xml
  TODO: add test-suites support (single file ?)
  TODO: support --parallel run
*/

var builder = require('xmlbuilder');
var fs      = require('fs');
var pathLib = require('path');
var ensure  = require('ensureDir');
var utils   = require('util');


var updateTime = function updateTime (/* step or suite */ subject) {
  subject.time = new Date() - subject.time;
};

var updateAssertions = function updateAssertions (subject, type) {
  subject.assertions += /(assert|verify)/.test(type);
};

var formatTime = function formatTime (subject) {
  subject.time = parseFloat(subject.time / 1000, 10).toFixed(3);
};

var getSuite = function getSuite (testRun) {
  return {
    package: testRun.browserOptions.browserName || '',
    name: sanitize(testRun.name),
    tests: 0,
    errors: 0,
    failures: 0,
    assertions: 0,
    skipped: 0,
    time: new Date().getTime(),
    steps: []
  };
};

var getStep = function getStep (step) {
  return {
    classname: step.name || step.type,
    name: step.name || '',
    assertions: 0,
    time: new Date()
  };
};

var updateSuite = function updateSuite (suite, info, step) {
  if (!step.noreport) {
    if (!info.success) {
      suite.failures += 1;
    }
    suite.tests += 1;
    updateAssertions(suite, step.type);
  }
};

var updateStep = function updateStep (step, info) {
  updateTime(step);
  updateAssertions(step, info.type);
};

var addAttributes = function add (node, data) {
  Object.keys(data).forEach(function (key) {
    node.att(key, data[key]);
  });
};

var generateReport = function generateReport (suite) {

  var xml = builder.create('testsuite', null, {
    version: '1.0',
    encoding: 'UTF-8',
    standalone: true
  });

  updateTime(suite);
  formatTime(suite);

  suite.steps.forEach(function (testCase) {
    formatTime(testCase);
    var node = xml.ele('testcase');
    addAttributes(node, testCase);
  });

  delete suite.steps;
  addAttributes(xml, suite);

  return xml;
};

var writeReport = function writeReport (path, /* xmlbuilder*/ data) {

  var dirname  = pathLib.dirname(path);

  ensure(dirname, 0777, function ensureDirCB (err) {
    if (err) {
      console.log('Error '+ utils.inspect(err));
      return;
    }
    fs.writeFileSync(path, data.toString({pretty:true}));
    console.log('Report saved to %s', path);
  });
};

var sanitize = function sanizite(reportName){
   return reportName.replace(/,/g, '').replace(/\s+/g, '_');
};

var log = function log (status, step, message) {
  if (step.noreport) { return; }
  message = (status.success ? '[PASS] ' : '[FAIL] ') + step.name || '';
  console.log(message);
};

var logOnError = function logOnError (status, step, /*null*/ message) {
  if (step.noreport || status.success) { return; }
  message = '[FAIL] ' + step.name || '';
  console.log(message);
};

//--

var Aggregator = function Aggregator (testRun, opts, runner) {

  Aggregator.instances = (this._uid = Aggregator.instances + 1);

  var reportFileName = 'junit-'+ testRun.name +'-'+ this._uid +'.xml';

  this._opts      = JSON.parse(JSON.stringify(opts));
  this._opts.path = opts.path ?
                      pathLib.join(opts.path, reportFileName) :
                      pathLib.join(process.cwd(), reportFileName);

  this._suite = null;
  this._step  = null;
  this._runnr = runner;
};

Aggregator.instances = 0;
Aggregator.VERSION = '0.1.3';
Aggregator.SE_INTERPRETER_SUPPORT = '1.0.6';

Aggregator.prototype.startTestRun = function(testRun, info) {
  if (!info.success) {
    console.log('[ERROR] '+ utils.inspect(info));
    return;
  }
  console.log('[Aggregator-'+this._uid+']::startTestRun - '+ testRun.name);
  this._suite = getSuite(testRun);
};

Aggregator.prototype.startStep  = function startStep (testRun, step) {
  this._step = getStep(step);
  this._step.name = testRun.name || '';
};

Aggregator.prototype.endStep = function endStep (testRun, step, info) {
  logOnError(info, step);
  updateStep(this._step, step);
  updateSuite(this._suite, info, step);
  this._suite.steps.push(this._step);
  this._step = null;
};

Aggregator.prototype.endTestRun = function(testRun /* ,info */) {
  var report = generateReport(this._suite, testRun);
  console.log('[Aggregator-'+this._uid+']::endTestRun - '+ this.testRun.name);
  writeReport(sanitize(this._opts.path), report);
};


exports.getInterpreterListener = function(testRun, options, interpreter) {
  /*

  // needs se-interpreter to expose 'VERSION' first !

  if (interpreter.VERSION !== Aggregator.SE_INTERPRETER_SUPPORT) {
    var msg = [
      '[Warning]',
      'Se-Interpreter version has changed to '+ interpreter.VERSION,
      'It\'s api may have changed, expect side effects',
      'Latest supported version is '+ Aggregator.SE_INTERPRETER_SUPPORT
    ].join('\n');

    console.log(msg);
  }
  */

  return new Aggregator(testRun, options, interpreter);
};
