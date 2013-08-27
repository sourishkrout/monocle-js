/*global it:true, describe:true */
"use strict";
var monocle = require('../lib/monocle')
  , o0 = monocle.o0
  , launch = monocle.launch
  , run = monocle.run
  , Return = monocle.Return
  , oC = monocle.callback
  , should = require('should');

var sleep = o0(function*(secs) {
  var cb = oC();
  setTimeout(cb, secs * 1000);
  yield cb;
});

var square = o0(function*(x) {
  yield x * x;
});

var cube = o0(function*(x) {
  var squareOfX = yield square(x);
  yield x * squareOfX;
});

describe('monocle', function() {
  it('should not reach code after returns', function(done) {
    var shouldntChange = "foo";
    var square = o0(function*(x) {
      yield new Return(x * x);
      shouldntChange = "bar";
    });
    run(function*() {
      var s = yield square(3);
      s.should.equal(9);
      shouldntChange.should.equal('foo');
      done();
    });
  });

  it('should work without new', function(done) {
    run(function*() {
      var s = yield square(4);
      s.should.equal(16);
      var start = Date.now();
      yield sleep(0.5);
      (Date.now() - start).should.be.above(499);
      done();
    });
  });

  it('should work with new asynchronously', function(done) {
    var f1 = o0(function*() {
      var cb = oC();
      setTimeout(cb, 500);
      yield cb;
    });
    run(function*() {
      var start = Date.now();
      yield f1();
      (Date.now() - start).should.be.above(499);
      done();
    });
  });

  it('should catch exceptions and exit oroutine', function(done) {
    var shouldntChange = "foo";
    var fail1 = o0(function*() {
      throw new Error("foo bar baz");
      shouldntChange = "bar";
    });
    var fail2 = o0(function*() {
      yield fail1();
    });
    run(function*() {
      var err;
      try {
        yield fail2();
      } catch(e) {
        err = e;
      }
      should.exist(err);
      err.message.should.equal("foo bar baz");
      shouldntChange.should.equal("foo");
      done();
    });
  });

  it('should catch exceptions in async functions', function(done) {
    var shouldntChange = "foo";
    var errInAsync = function(cb) {
      cb(new Error("foo bar baz"));
    };
    var fail1 = o0(function*() {
      var cb = oC();
      errInAsync(cb);
      yield cb;
    });
    var fail2 = o0(function*() {
      yield fail1();
    });
    run(function*() {
      var err;
      try {
        yield fail2();
      } catch(e) {
        err = e;
      }
      should.exist(err);
      err.message.should.equal("foo bar baz");
      shouldntChange.should.equal("foo");
      done();
    });
  });

  it('should work with launch', function(done) {
    launch(o0(function*() {
      var x = yield square(5);
      x.should.equal(25);
      done();
    }));
  });

  it('should work with embedded o-routines', function(done) {
    run(function*() {
      var x = yield cube(3);
      x.should.equal(27);
      done();
    });
  });

  it('should pass multiple parameters to o-routine', function(done) {
    var add = o0(function*(x, y) {
      yield x + y;
    });
    run(function*() {
      var sum = yield add(3, 6);
      sum.should.equal(9);
      done();
    });
  });

  it('should handle converting node-style async err handling', function(done) {
    var asyncFn = function(shouldErr, cb) {
      if (shouldErr) {
        return cb(new Error("bad"));
      }
      cb(null, "yay!");
    };
    var syncFn = o0(function*(shouldErr) {
      var cb = oC();
      asyncFn(shouldErr, cb);
      yield (yield cb);
    });
    run(function*() {
      var res = yield syncFn(false);
      res.should.equal("yay!");
      var err;
      try {
        res = yield syncFn(true);
      } catch (e) {
        err = e;
      }
      should.exist(err);
      err.message.should.equal("bad");
      done();
    });
  });

  it('should bind generators to calling object', function(done) {
    var bindObj = {
      foo: 'bar'
    };

    bindObj.gen = o0(function*() {
      yield this.foo;
    });

    run(function*() {
      var res = yield this.gen();
      res.should.equal('bar');
      done();
    }, bindObj);
  });

  it('should work with classes', function(done) {
    var MyClass = function() {
      this.foo = 'bar';
    };
    MyClass.prototype.myOroutine = o0(function*() {
      var s = yield square(3);
      yield this.foo + ' ' + s;
    });
    MyClass.prototype.run = function(gen) {
      run(gen, this);
    };
    var obj = new MyClass();
    obj.run(function*() {
      var res = yield this.myOroutine();
      res.should.equal('bar 9');
      done();
    });
  });
});
