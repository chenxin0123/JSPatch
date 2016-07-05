//全局对象this的别名
var global = this

;(function() {

  //对象
  var _ocCls = {};
  var _jsCls = {};

  var _formatOCToJS = function(obj) {
    if (obj === undefined || obj === null) return false
    if (typeof obj == "object") {
      if (obj.__obj) return obj
      if (obj.__isNil) return false
    }
    if (obj instanceof Array) {
      var ret = []
      obj.forEach(function(o) {
        ret.push(_formatOCToJS(o))
      })
      return ret
    }
    if (obj instanceof Function) {
        return function() {
            var args = Array.prototype.slice.call(arguments)
            var formatedArgs = _OC_formatJSToOC(args)
            for (var i = 0; i < args.length; i++) {
                if (args[i] === null || args[i] === undefined || args[i] === false) {
                formatedArgs.splice(i, 1, undefined)
            } else if (args[i] == nsnull) {
                formatedArgs.splice(i, 1, null)
            }
        }
        return _OC_formatOCToJS(obj.apply(obj, formatedArgs))
      }
    }
    if (obj instanceof Object) {
      var ret = {}
      for (var key in obj) {
        ret[key] = _formatOCToJS(obj[key])
      }
      return ret
    }
    return obj
  }
  /** _methodFunc把相关信息传给OC，OC用 Runtime 接口调用相应方法，返回结果值，这个调用就结束了。
   */
  var _methodFunc = function(instance, clsName, methodName, args, isSuper, isPerformSelector) {
    var selectorName = methodName
    if (!isPerformSelector) {
      methodName = methodName.replace(/__/g, "-")
      selectorName = methodName.replace(/_/g, ":").replace(/-/g, "_")
      var marchArr = selectorName.match(/:/g)
      var numOfArgs = marchArr ? marchArr.length : 0
      if (args.length > numOfArgs) {
        selectorName += ":"
      }
    }
    var ret = instance ? _OC_callI(instance, selectorName, args, isSuper):
                         _OC_callC(clsName, selectorName, args)
    return _formatOCToJS(ret)
  }

  //_customMethods 是个对象
  var _customMethods = {
    /** 
     给 JS 对象基类 Object 加上 __c 成员，这样所有对象都可以调用到 __c，根据当前对象类型判断进行不同操作：
     
     UIView.alloc() -> UIView.__c("alloc")()
     */
    __c: function(methodName) {
  
      //this表示_customMethods对象
      var slf = this
      //???布尔变量
      if (slf instanceof Boolean) {
        return function() {
          return false
        }
      }
  
      if (slf[methodName]) {
        return slf[methodName].bind(slf);
      }
  
      /**
       目前没找到方法判断一个 JS 对象是否表示 OC 指针，这里的解决方法是在 OC 把对象返回给 JS 之前，先把它包装成一个 NSDictionary：
       static NSDictionary *_wrapObj(id obj) {
       return @{@"__obj": obj};
       }
       */
      //不是OC指针 且 不是OCClass
      if (!slf.__obj && !slf.__clsName) {
        throw new Error(slf + '.' + methodName + ' is undefined')
      }
  
      //父类
      if (slf.__isSuper && slf.__clsName) {
          slf.__clsName = _OC_superClsName(slf.__obj.__realClsName ? slf.__obj.__realClsName: slf.__clsName);
      }
  
      var clsName = slf.__clsName
      if (clsName && _ocCls[clsName]) {
        //实例方法还是类方法
        var methodType = slf.__obj ? 'instMethods': 'clsMethods'
        if (_ocCls[clsName][methodType][methodName]) {
          slf.__isSuper = 0;
          return _ocCls[clsName][methodType][methodName].bind(slf)
        }

        if (slf.__obj && _ocCls[clsName]['props'][methodName]) {
          if (!slf.__ocProps) {
            var props = _OC_getCustomProps(slf.__obj)
            if (!props) {
              props = {}
              _OC_setCustomProps(slf.__obj, props)
            }
            slf.__ocProps = props;
          }
          var c = methodName.charCodeAt(3);
          if (methodName.length > 3 && methodName.substr(0,3) == 'set' && c >= 65 && c <= 90) {
            return function(val) {
              var propName = methodName[3].toLowerCase() + methodName.substr(4)
              slf.__ocProps[propName] = val
            }
          } else {
            return function(){ 
              return slf.__ocProps[methodName]
            }
          }
        }
      }

      return function(){
        var args = Array.prototype.slice.call(arguments)
        return _methodFunc(slf.__obj, slf.__clsName, methodName, args, slf.__isSuper)
      }
    },

  /**
   首先 JS 端需要告诉OC想调用的是当前对象的 super 方法，做法是调用 self.super()时，__c 函数会做特殊处理，返回一个新的对象，这个对象同样保存了 OC 对象的引用，同时标识 __isSuper = 1。
   
   再用这个返回的对象去调用方法时，__c 函数会把 __isSuper 这个标识位传给 OC，告诉 OC 要调 super 的方法。OC 做的事情是，如果是调用 super 方法，找到 superClass 这个方法的 IMP 实现，为当前类新增一个方法指向 super 的 IMP 实现，那么调用这个类的新方法就相当于调用 super 方法。把要调用的方法替换成这个新方法，就完成 super 方法的调用了。
   */
    super: function() {
      var slf = this
      if (slf.__obj) {
        slf.__obj.__realClsName = slf.__realClsName;
      }
      return {__obj: slf.__obj, __clsName: slf.__clsName, __isSuper: 1}
    },

    performSelectorInOC: function() {
      var slf = this
      var args = Array.prototype.slice.call(arguments)
      return {__isPerformInOC:1, obj:slf.__obj, clsName:slf.__clsName, sel: args[0], args: args[1], cb: args[2]}
    },

    performSelector: function() {
      var slf = this
      var args = Array.prototype.slice.call(arguments)
      return _methodFunc(slf.__obj, slf.__clsName, args[0], args.splice(1), slf.__isSuper, true)
    }
  }

  for (var method in _customMethods) {
    if (_customMethods.hasOwnProperty(method)) {
      /*
       Object.defineProperty(obj, prop, descriptor) 方法直接在一个对象上定义一个新属性，或者修改一个已经存在的属性， 并返回这个对象
       
       descriptor 可包含4个属性，如下：
       configurable 当且仅当这个属性描述符值为 true 时，该属性可能会改变，也可能会被从相应的对象删除。默认为 false。
       enumerable true 当且仅当该属性出现在相应的对象枚举属性中。默认为 false。
       value 属性的值
       writable 定义属性值是否可写。
       get 一个给属性提供 getter 的方法，如果没有 getter 则为 undefined。方法将返回用作属性的值。默认为 undefined。
       set 同get一起使用，功能互补。
       
       在JavaScript中，所有的对象都是基于 Object；所有的对象都继承了Object.prototype的属性和方法
       prototype 属性使您有能力向对象添加属性和方法。
       .prototype 获取该对象的原型 可以理解为class
       这句话给Object.prototype添加一个method属性
       */
      Object.defineProperty(Object.prototype, method, {value: _customMethods[method], configurable:false, enumerable: false})
    }
  }

  /**
   调用 require('UIView') 后，就可以直接使用 UIView 这个变量去调用相应的类方法了，require 做的事很简单，就是在JS全局作用域上创建一个同名变量，变量指向一个对象，对象属性 __clsName 保存类名，同时表明这个对象是一个 OC Class。
   */
  var _require = function(clsName) {
    if (!global[clsName]) {
      /*所以调用 require('UIView') 后，就在全局作用域生成了 UIView 这个变量，指向一个这样一个对象：
       {
         __clsName: "UIView"
       }
       */
      global[clsName] = {
        __clsName: clsName
      }
    } 
    return global[clsName]
  }

  global.require = function(clsNames) {
    var lastRequire
  //多个类 以逗号分隔
  //forEach() method calls a provided function once for each element in an array
    clsNames.split(',').forEach(function(clsName) {
      //调用_require方法
      lastRequire = _require(clsName.trim())
    })
    return lastRequire
  }

  /**
   JSPatch支持直接在defineClass里的实例方法里直接使用 self 关键字
   跟OC一样 self 是指当前对象，这个 self 关键字是怎样实现的呢？
   实际上这个self是个全局变量，在 defineClass 里对实例方法进行了包装，在调用实例方法之前，会把全局变量 self 设为当前对象，调用完后设回空，就可以在执行实例方法的过程中使用 self 变量了。这是一个小小的trick。
   */
  var _formatDefineMethods = function(methods, newMethods, realClsName) {
    for (var methodName in methods) {
      if (!(methods[methodName] instanceof Function)) return;
      (function(){
        var originMethod = methods[methodName]
        newMethods[methodName] = [originMethod.length, function() {
          try {
            var args = _formatOCToJS(Array.prototype.slice.call(arguments))
            var lastSelf = global.self
            global.self = args[0]
            if (global.self) global.self.__realClsName = realClsName
            args.splice(0,1)
            var ret = originMethod.apply(originMethod, args)
            global.self = lastSelf
            return ret
          } catch(e) {
            _OC_catch(e.message, e.stack)
          }
        }]
      })()
    }
  }

  var _wrapLocalMethod = function(methodName, func, realClsName) {
    return function() {
      var lastSelf = global.self
      global.self = this
      this.__realClsName = realClsName
      var ret = func.apply(this, arguments)
      global.self = lastSelf
      return ret
    }
  }

  var _setupJSMethod = function(className, methods, isInst, realClsName) {
    for (var name in methods) {
      var key = isInst ? 'instMethods': 'clsMethods',
          func = methods[name]
      _ocCls[className][key][name] = _wrapLocalMethod(name, func, realClsName)
    }
  }

  /**
   defineClass 定义的方法会经过 JS 包装，变成一个包含参数个数和方法实体的数组传给OC，OC会判断如果方法已存在，就执行替换的操作，若不存在，就调用 class_addMethod() 新增一个方法，通过传过来的参数个数和方法实体生成新的 Method，把 Method 的参数和返回值类型都设为id。这里 JS 调用新增方法走的流程还是 forwardInvocation 这一套。
   
   */
  global.defineClass = function(declaration, properties, instMethods, clsMethods) {
    var newInstMethods = {}, newClsMethods = {}
    if (!(properties instanceof Array)) {
      clsMethods = instMethods
      instMethods = properties
      properties = null
    }

    var realClsName = declaration.split(':')[0].trim()

    _formatDefineMethods(instMethods, newInstMethods, realClsName)
    _formatDefineMethods(clsMethods, newClsMethods, realClsName)

    var ret = _OC_defineClass(declaration, newInstMethods, newClsMethods)
    var className = ret['cls']
    var superCls = ret['superCls']

    _ocCls[className] = {
      instMethods: {},
      clsMethods: {},
      props: {}
    }

    if (superCls.length && _ocCls[superCls]) {
      for (var funcName in _ocCls[superCls]['instMethods']) {
        _ocCls[className]['instMethods'][funcName] = _ocCls[superCls]['instMethods'][funcName]
      }
      for (var funcName in _ocCls[superCls]['clsMethods']) {
        _ocCls[className]['clsMethods'][funcName] = _ocCls[superCls]['clsMethods'][funcName]
      }
      if (_ocCls[superCls]['props']) {
        _ocCls[className]['props'] = JSON.parse(JSON.stringify(_ocCls[superCls]['props']));
      }
    }

    _setupJSMethod(className, instMethods, 1, realClsName)
    _setupJSMethod(className, clsMethods, 0, realClsName)

    if (properties) {
      properties.forEach(function(o){
        _ocCls[className]['props'][o] = 1
        _ocCls[className]['props']['set' + o.substr(0,1).toUpperCase() + o.substr(1)] = 1
      })
    }
    return require(className)
  }

  global.defineProtocol = function(declaration, instProtos , clsProtos) {
      var ret = _OC_defineProtocol(declaration, instProtos,clsProtos);
      return ret
  }

  global.block = function(args, cb) {
    var slf = this
    if (args instanceof Function) {
      cb = args
      args = ''
    }
    var callback = function() {
      var args = Array.prototype.slice.call(arguments)
      return cb.apply(slf, _formatOCToJS(args))
    }
    return {args: args, cb: callback, __isBlock: 1}
  }
  
  if (global.console) {
    var jsLogger = console.log;
    global.console.log = function() {
      global._OC_log.apply(global, arguments);
      if (jsLogger) {
        jsLogger.apply(global.console, arguments);
      }
    }
  } else {
    global.console = {
      log: global._OC_log
    }
  }

  global.defineJSClass = function(declaration, instMethods, clsMethods) {
    var o = function() {},
        a = declaration.split(':'),
        clsName = a[0].trim(),
        superClsName = a[1] ? a[1].trim() : null
    o.prototype = {
      init: function() {
        if (this.super()) this.super().init()
        return this;
      },
      super: function() {
        return superClsName ? _jsCls[superClsName].prototype : null
      }
    }
    var cls = {
      alloc: function() {
        return new o;
      }
    }
    for (var methodName in instMethods) {
      o.prototype[methodName] = instMethods[methodName];
    }
    for (var methodName in clsMethods) {
      cls[methodName] = clsMethods[methodName];
    }
    global[clsName] = cls
    _jsCls[clsName] = o
  }
  
  global.YES = 1
  global.NO = 0
  global.nsnull = _OC_null
  global._formatOCToJS = _formatOCToJS
  
})()