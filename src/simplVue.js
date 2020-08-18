const compileUtil = {
  getVal(expr, vm) {
    return expr.split('.').reduce((data, currentVal) => {
      return data[currentVal];
    }, vm.$data);
  },

  setVal(expr, vm, inputVal) {
    const arr = expr.split('.');
    let i = 0;
    arr.reduce((data, currentData) => {
      if (arr.length - 1 === i) {
        data[currentData] = inputVal;
      }
      i++;
      return data[currentData];
    }, vm.$data);
  },

  getContentVal(expr, vm) {
    return value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(args[1], vm);
    })
  },

  text(node, expr, vm) {//expr:msg
    let value
    // 如果是赋值表达式
    if (expr.indexOf('{{') !== -1) {
      //{{person.name}} -- {{person.age}}
      value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        new Watcher(vm, args[1], (newVal) => {
          this.updater.textUpdater(node, this.getContentVal(expr, vm))
        })
        return this.getVal(args[1], vm)
      })
    } else {
      //expr person.girlfriend.name
      // getVal可以递归的取到深层次的数据
      value = this.getVal(expr, vm);
    }
    this.updater.textUpdater(node, value);
  },
  html(node, expr, vm) {
    const value = this.getVal(expr, vm);
    // 添加watcheer
    new Watcher(vm, expr, (newVal) => {
      this.updater.htmlUpdater(node, newVal);
    })
    this.updater.htmlUpdater(node, value);
  },
  model(node, expr, vm) {
    const value = this.getVal(expr, vm);
    // 绑定更新函数，数据驱动视图
    new Watcher(vm, expr, (newVal) => {
      this.updater.modelUpdater(node, newVal);
    })

    // 视图驱动数据
    node.addEventListener('input', (e) => {
      // 设置值
      this.setVal(expr, vm, e.target.value);
    })
    this.updater.modelUpdater(node, value);
  },
  on(node, expr, vm, eventName) {
    let fn = vm.$options.methods && vm.$options.methods[expr]
    node.addEventListener(eventName, fn.bind(vm), false);
  },
  bind(node, expr, vm, eventName) {
    const value = this.getVal(expr, vm);
    new Watcher(vm, expr, (newVal) => {
      node.setAttribute(eventName, newVal);
    })
    node.setAttribute(eventName, value);
    node.removeAttribute('v-bind:' + eventName);
  },

  // 更新函数
  updater: {
    textUpdater(node, value) {
      node.textContent = value;
    },
    htmlUpdater(node, value) {
      node.innerHTML = value;
    },
    modelUpdater(node, value) {
      node.value = value;
    }
  }
}

class Compiler {
  constructor(el, vm) {
    // 判断el是否是元素节点，如果不是则为字符串需要获取对应的DOM节点
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 获取文档碎片对象，放入内存中会减少页面的回流和重绘
    const fragment = this.node2Fragment(this.el);
    // 编译模板
    this.compile(fragment);
    // 将编译后的模板渲染在页面上
    this.el.appendChild(fragment);
  }

  compile(fragment) {
    // 获取子节点
    const childNodes = fragment.childNodes;
    [...childNodes].map(child => {
      // 如果子节点是元素节点
      if (this.isElementNode(child)) {
        // 编译元素节点
        // console.log('元素节点',child);
        // 元素节点还要递归遍历里面的子节点

        this.compileElement(child);
        if (child.childNodes && child.childNodes.length) {
          this.compile(child);
        }
      } else {
        // 文本节点
        this.compileText(child);
        // console.log('文本节点',child);
      }
    })
  }

  compileElement(node) {
    const attributes = node.attributes;
    [...attributes].forEach(attr => {
      const { name, value } = attr;
      if (this.isDirective(name)) {//是一个v-开头的指令  v-text v-html v-model v-on:click
        const [, directive] = name.split('-'); // text html mode on:click
        const [dirName, eventName] = directive.split(':') // dirName : text html model on  eventName: click
        // 更新数据 数据驱动视图
        compileUtil[dirName](node, value, this.vm, eventName);
        // 删除有指令的标签上的属性
        node.removeAttribute('v-' + dirName);
      } else if (this.isEventName(name)) {//@click=''
        const [, eventName] = name.split('@');
        compileUtil['on'](node, value, this.vm, eventName);
      }
    })
  }

  compileText(node) {
    // // {{}}
    const content = node.textContent;
    // // 是否有双括号
    if (/\{\{(.+?)\}\}/.test(content)) {
      // console.log(content);
      compileUtil['text'](node, content, this.vm);
    }
  }

  node2Fragment(el) {
    // 创建文档碎片对象
    const f = document.createDocumentFragment();
    let firstChild;
    // 如果存在firstChild（有子节点），则从父节点中拿出来赋值给firstChild
    while (firstChild = el.firstChild) {
      f.append(firstChild);
    }
    return f;
  }

  isElementNode(node) {
    return node.nodeType === 1;
  }

  isDirective(name) {
    return name.startsWith('v-');
  }

  isEventName(name) {
    return name.startsWith('@');
  }

}

// 订阅者
class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    this.oldVal = this.getOldVal();
  }

  // 获取旧的值
  getOldVal() {
    Dep.target = this;
    const oldVal = compileUtil.getVal(this.expr, this.vm);
    Dep.target = null;
    return oldVal;
  }

  // 更新
  update() {
    const newVal = compileUtil.getVal(this.expr, vm);
    if (newVal !== this.oldVal) {
      this.cb(newVal);
    }
  }

}

// 发布者
class Dep {
  constructor() {
    this.subs = [];
  }

  // 收集观察者
  addWatcher(watcher) {
    this.subs.push(watcher)
  }

  // 通知更新
  notify() {
    console.log(this.subs);
    this.subs.forEach(watcher => {
      watcher.update();
    })
  }
}

class Observer {
  constructor(data) {
    this.observe(data);
  }

  observe(data) {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key]);
      })
    }
  }

  defineReactive(obj, key, value) {
    // 递归遍历
    this.observe(value);
    const dep = new Dep();
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get() {
        // 订阅数据变化时，往Dep中添加订阅者
        Dep.target && dep.addWatcher(Dep.target);
        return value;
      },
      // 注意此处箭头函数是为了之后调用时候的this不会改变
      set: (newVal) => {
        this.observe(newVal);
        if (value !== newVal) {

          value = newVal
        }
        // 更新
        dep.notify();
      }
    })
  }
}

class MyVue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.vm = this;
    this.$options = options;
    if (this.$el) {
      // 实现一个数据观察者
      new Observer(this.$data);
      // 实现一个指令解析器
      // 传入需要绑定的根元素以及vm实例
      new Compiler(this.$el, this);

      // 代理this.$data -> this
      this.proxyData(this.$data);
    }
  }
  proxyData(data) {
    for (const key in data) {
      Object.defineProperty(this, key, {

        get() {
          return data[key];
        },
        set(newVal) {
          data[key] = newVal;
        }
      })
    }
  }
}