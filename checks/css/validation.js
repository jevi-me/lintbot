var
  util = require('util'),
  exec = require('child_process').exec,
  xmlParser = require('xml2js').parseString,
  previousLineCausedIgnorableError = false
;

const cleanMessage = function (message) {
  message = message.replace(/\s+/g, ' ');
  return message;
};

const shouldIncludeError = function (message, line, lines) {
  if (previousLineCausedIgnorableError) {
    previousLineCausedIgnorableError = false;
    return false;
  }

  // Caused by @viewport
  if (message == 'Parse Error' && line == 1) return false;
  if (message.match(/at-rule @.*viewport/i)) return false;

  if (message.match(/text-size-adjust/i)) return false;

  // Works around validator's calc() bug
  if (message.match(/value error.*parse error/i)) return false;

  if (message.match(/parse error/i)) {
    // Another work around for validator's calc() bug
    if (lines[line - 1].match(/calc/)) {
      previousLineCausedIgnorableError = true;
      return false;
    }
  }

  return true;
};

module.exports.check = function (fullContent, path, lines, group, cb) {
  cb('validation', group, 'start', 'Validation');

  exec('java -jar vendor/css-validator.jar --output=soap12 file://' + path, function (err, data) {
    var xml = data.trim().replace(/^\{.*\}/, '').trim();

    xmlParser(xml, function (err, result) {
      var
        results = result['env:Envelope']['env:Body'][0]['m:cssvalidationresponse'][0]['m:result'][0]['m:errors'][0],
        errorCount = parseInt(results['m:errorcount'][0], 10),
        errorsList = results['m:errorlist'][0]['m:error'],
        errors = [],
        prevError = false
      ;

      if (errorCount > 0) {
        errorsList.forEach(function (error) {
          var
            line = error['m:line'][0],
            message = error['m:message'][0].trim().replace(/\s*\:$/, '.')
          ;

          if (shouldIncludeError(message, line, lines)) {
            errors.push(util.format('Line %d: %s', line, message));
          }

          prevError = message;
        });
      }

      cb('validation', group, 'end', 'Validation', errors);
    });
  });
};
