'use strict';

/* eslint max-nested-callbacks: 0 */
/* eslint no-invalid-this: 0 */

describe('cdnup', function () {
  this.timeout(60000);
  var AwsLiveness = require('aws-liveness');
  var { S3 } = require('aws-sdk');
  var assume = require('assume');
  var clone = require('clone');
  var CDNUp = require('..');
  var resolve = require('url').resolve;
  var fixture = require('path').resolve(__dirname, 'fixture.js');
  var config = require('./mock-config');
  var root = config.prefix || 'cdnup';

  //
  // Define a local var so we override it.
  //
  var cdnup;

  function subdomainConfig() {
    const conf = clone(config);
    conf.pkgcloud.forcePathBucket = false;
    conf.subdomain = true;

    return conf;
  }
  cdnup = new CDNUp(root, config);
  before(async function () {
    await new AwsLiveness().waitForServices({
      clients: [new S3(cdnup.client._awsConfig)],
      waitSeconds: 60
    });
  });

  beforeEach(function () {
    cdnup = new CDNUp(root, config);
  });

  it('exports as a function', function () {
    assume(CDNUp).is.a('function');
  });

  describe('#init', function () {
    it('inits the bucket', function (next) {
      cdnup.init(function (err) {
        if (err) return next(err);
        next();
      });
    });
  });

  describe('uploadOpts', function () {
    var cdn = new CDNUp(root, {
      ...clone(config),
      uploadOpts: {
        cacheControl: 'max-age=1209600'
      }
    });

    it('sets uploadOpts', function () {
      assume(cdn.uploadOpts.cacheControl).equals('max-age=1209600');
    });
  });

  describe('#upload', function () {
    it('creates a connection with the server', function (next) {
      var name = 'uploaded-fixture.js';
      cdnup.upload(fixture, name, function (err) {
        if (err) return next(err);

        cdnup.client.getFiles(cdnup.bucket, (error, files) => {
          if (error) return next(error);
          var filtered = files.filter(f => f.name === name);
          assume(filtered.length).equals(1);
          next();
        });
      });
    });

    it('uploads fixture with path in fixture name', function (next) {
      var name = 'fingerprint/uploaded-fixture.js';
      cdnup.upload(fixture, name, function (err) {
        if (err) return next(err);

        cdnup.client.getFiles(cdnup.bucket, (error, files) => {
          if (error) return next(error);
          var filtered = files.filter(f => f.name === name);
          assume(filtered.length).equals(1);
          next();
        });
      });
    });

    it('returns a url with the location of the file', function (next) {
      cdnup.upload(fixture, 'hello-fixture.js', function (err, url) {
        if (err) return next(err);

        assume(url).equals(resolve(cdnup.url(), 'hello-fixture.js'));
        next();
      });
    });

    it('supports subdomain/true option for the URL it produces', function () {
      const conf = subdomainConfig();
      const cdn = new CDNUp(conf.prefix, conf);
      const uri = resolve(cdn.url(), 'hello-fixture.js');

      assume(uri).startsWith(`https://${cdnup.bucket}`);
    });

    it('supports check URL replacement', function () {
      var conf = subdomainConfig();
      conf.check = `https://${conf.prefix}.s3.amazonaws.com/`;
      conf.url = `https://whatever.com/world`;
      const cdn = new CDNUp(conf.prefix, conf);
      const what  = `https://whatever.com/world/hello-fixture.js`;
      assume(cdn.checkUrl(what)).contains(conf.check);
    });
  });
});
