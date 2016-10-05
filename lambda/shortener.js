// Lambda URL shortener function, called via API Gateway
// Creates an Amazon S3 object with random name and adds metadata for http redirect
var AWS = require('aws-sdk');
var url = require('url');

// configuration to be customized
var S3_Bucket = "urlshortener-test-s3bucketforurls-1m7k0e1jhia27";
var S3_Region = "ap-southeast-2";
var S3_Prefix = "u";

// generate a 7 char shortid
var shortid = function() {
  return 'xxxxxxx'.replace(/x/g, function(c) {
    return (Math.random()*36|0).toString(36);
  });
}

exports.handler = function(event, context) {
  var s3 = new AWS.S3({ region: S3_Region });
  var url_long = event.url_long;
  var url_short = event.url_short;
  var cdn_prefix = event.cdn_prefix;
  var retry = 0;    // try at most 3 times to create unique id

  var done = function (url_short, error) {
    context.succeed({ url_long: url_long, url_short: url_short, error: error });
  };

  var check_and_create_s3_redirect = function(s3_bucket, key_short, url_long) {
    s3.headObject({ Bucket: s3_bucket, Key: key_short }, function(err, data) {
      if (err) {
        // we should normall have a NotFound error showing that the id is not already in use
        if (err.code === "NotFound") {
          // normal execution path
          s3.putObject({ Bucket: s3_bucket, Key: key_short, Body: "", WebsiteRedirectLocation: url_long, ContentType: "text/plain" }, 
            function(err, data) {
              if (err) { done("", err.message); }
              else {
                var ret_url = "https://" + cdn_prefix + "/" + id_short;
                console.log("Success, short_url = "+ret_url);
                done(ret_url, "");
              }
            });
        } else {
          // treat all other errors as fatal
          done("", "Could not find an suitable name, error: " + err.code);
        }
      } else {
        done("", "Shortid is already in use" );
      }
    });
  }

  // check if url is valid
  var url_check = url.parse(url_long);
  if (!((url_check) && (url_check.host))) { return done("", "Invalid URL format"); }

  var id_short = (url_short) ? url_short : shortid();
  console.log("Long URL to shorten: " + url_long + " to " + id_short);
  var key_short = S3_Prefix + "/" + id_short;
  console.log("Short id = " + key_short);
  check_and_create_s3_redirect(S3_Bucket, key_short, url_long);
};
