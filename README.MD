# Simple  Vue
## 序
​        在完成了Vue.js的基本知识学习以及在项目中运用Vue.js后，还需要对Vue的原理进行更深层次的理解。这个SimpleVue是仿照Vue的双向数据绑定原理而写，旨在更好地理解Vue的原理，在之后学习工作中可以对Vue有更好的把握，也为之后对Vue源码的学习打下好的基础。
## new MyVue 实例
​        index.html文件如下所示,其中新建了仿写的MyVue实例，并且实现了Vue中的"插值表达式{{}}"、"v-text"、 "v-html"、"v-mode"、 "v-on:eventName/@eventName"、"v-bind"指令.
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <script src="./simplVue.js"></script>
  </head>
  <body>
    <div id="app">
      <h1>{{msg}}</h1>
      <h2>{{person.name}} -- {{person.age}}</h2>
      <h3>{{person.fav}}</h3>
      <ul>
        <li>1</li>
        <li>2</li>
        <li>3</li>
      </ul>
      <div v-text="msg"></div>
      <div v-text="person.age"></div>
      <div v-text="person.girlfriend.name"></div>
      <div v-html="htmlStr"></div>
      <input type="text" v-model="person.name" />
      <button v-on:click="handleClick">v-on</button>
      <button @click="handleClick">@click</button>
      <div v-bind:Asrc = 'src'>v-bind</div>
    </div>

    <script>
      let vm = new MyVue({
        el: '#app',
        data: {
          person: {
            name: '小陈',
            age: 27,
            fav:'姑娘',
            girlfriend: {
              name:'小李',
              age: 26
            }
          },
          msg : '好好学习，天天向上',
          htmlStr: '<h3>html可以显示吗</h3>',
          src: '我是src'
        },
        methods: {
          handleClick() {
            this.$data.person.name = '大陈';
          }
        }
      })
    </script>
  </body>
</html>
```
MyVue实现Vue的部分主要有：
- Compiler将解析vue的指令，将实例中的data挂载到页面中对应的位置，完成页面初始化，并且给每个属性订阅对应的Watcher
- Observer通过Object.defineProperty()劫持数据实现数据的监听，包括对象以及递归对象下的所有属性
- Watcher完成对数据前后的比较，如果数据发生变化则触发回调函数更新页面
- Dep完成对Watcher的收集，并且在数据发生变化时通知Watcher更新页面



## Vue模板编译 Compiler

​        原生的html在渲染页面时无法识别Vue的指令，需要实现Compiler将模板进行编译，此处的实现主要是采用的直接将Html中`el`下所有的DOM元素获取并且移动到新建的`DocumentFragment`中，在文档碎片对象中进行所有的DOM操作后再将其一起在页面中渲染，这样做可以减少频繁的DOM操作

```javascript
// 判断el是否是元素节点，如果不是则为字符串需要获取对应的DOM节点
this.el = this.isElementNode(el) ? el : document.querySelector(el);
this.vm = vm;
// 获取文档碎片对象，放入内存中会减少页面的回流和重绘
const fragment = this.node2Fragment(this.el);
// 编译模板
this.compile(fragment);
// 将编译后的模板渲染在页面上
this.el.appendChild(fragment);
```

Compiler主要实现两个功能

- 对模板中的类似于"{{person.name}}"的插值表达式进行编译，将期中的数据正确的显示出来
- 对模板中类似于"v-text,v-html,v-model,v-bind,v-on:eventNam"等指令进行编译，使其生效

```javascript
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

```



## Vue数据劫持Observer

​		Obeserver实现的功能是每当数据改变时，视图能够同时发生改变，即数据驱动视图，这个模块中主要实现的是里用Object.defineProperty对数据进行监听，每当get数据时，收集Watcher依赖，每当set数据即更新时，通知其观察者（watcher）触发回调函数进行更新，实现数据改变-->相应视图进行改变

```javascript
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
```

​		data中的对象和基本类型都可以依靠以上方法实现数据的响应式化，但数组需要使用另外的方式完成，并且直接用index的方式如`array[0] = '123'`进行赋值这样也是无法实现的，同时对象的属性增加和删除也无法实现响应式化，在实际的Vue2.0中使用的是Vue.set和Vue.delete来实现，此处就暂时略过，等之后深入再进行补充

## Vue的观察订阅模式：Watcher & Dep

​		此处实现依靠Wathcer（观察者）以及Dep（订阅者）

```javascript
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
```

在Obeserver类中，在进行数据劫持对，对每个属性创建了一个Dep，并且在获取数据时进行订阅，给当前Dep添加了对应属性的观察者，同时在每次设置属性新值时，对应的dep实例会通知其收集的所有观察者去调用回调函数进行更新

```javascript
defineReactive(obj, key, value) {
  this.observe(value);
  //创建dep绑定属性
  const dep = new Dep();
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      // 订阅数据变化时，往Dep中添加订阅者
      Dep.target && dep.addWatcher(Dep.target);
      return value;
    },
    set: (newVal) => {
      this.observe(newVal);
      if (value !== newVal) {

        value = newVal
      }
      // 发生数据更新时，通知所有观察者
      dep.notify();
    }
  })
}
```

而Watcher则在模板编译时，就对所有页面上的属性创建了对应的Watcher，并根据其特点设置了不同的回调函数（更新函数）

```javascript
const compileUtil = {  
  //...之前的代码略
  text(node, expr, vm) {
    let value
    if (expr.indexOf('{{') !== -1) {
      value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        //创建v-text的Watcher以及添加回调函数
        new Watcher(vm, args[1], (newVal) => {
          this.updater.textUpdater(node, this.getContentVal(expr, vm))
        })
        return this.getVal(args[1], vm)
      })
    } else {
      value = this.getVal(expr, vm);
    }
    this.updater.textUpdater(node, value);
  },
  html(node, expr, vm) {
    const value = this.getVal(expr, vm);
    //创建v-html的Watcher以及添加回调函数
    new Watcher(vm, expr, (newVal) => {
      this.updater.htmlUpdater(node, newVal);
    })
    this.updater.htmlUpdater(node, value);
  },
  model(node, expr, vm) {
    const value = this.getVal(expr, vm);
    //创建v-model的Watcher以及添加回调函数
    new Watcher(vm, expr, (newVal) => {
      this.updater.modelUpdater(node, newVal);
    })
    node.addEventListener('input', (e) => {
      this.setVal(expr, vm, e.target.value);
    })
    this.updater.modelUpdater(node, value);
  },
  bind(node, expr, vm, eventName) {
    const value = this.getVal(expr, vm);
    //创建v-bind的Watcher以及添加回调函数
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
```



## Vue数据的双向绑定

之前的步骤已经完成了数据视图的单向绑定，此处只需要在视图改变时，调用监听改变的函数，从而达到改变数据的目的，方法主要是利用对`input`进行监听，每当触发时，对Vue实例中的数据进行修改即可

```javascript
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
```



## Vue实例data数据的代理

在实际的Vue中，我们可以通过vm.person 对vm.$data.person进行访问是因为实现了对data的代理，在MyVue中实现也很简单，只需要利用Object.defineProperty对data中的所有属性代理到MyVue的this实例上，当调用`this[key]`(`vm[key]`)时实际获取的设定的是`vm.$data[key]`。

```javascript
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
```

