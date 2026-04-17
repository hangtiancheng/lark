function createTextNode(nodeValue) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue,
      children: [],
    },
  };
}

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) => {
        const isTextNode =
          typeof child === "string" || typeof child === "number";
        return isTextNode ? createTextNode(child) : child;
      }),
    },
  };
}

let nextWorkOfUnit = null;
let workInProgressFiberNode = null;
let workInProgressFiberRoot = null; // workInProgressFiberRoot 当前处理的 Fiber 树
// let currentFiberRoot = null; // currentFiberTree 当前渲染的 Fiber 树
let deletions = [];

function render(vNode /* element */, container) {
  workInProgressFiberRoot = {
    dom: container,
    props: {
      children: [vNode],
    },
  };
  nextWorkOfUnit = workInProgressFiberRoot;
}

function update() {
  let currentWorkOfUnit = workInProgressFiberNode;
  return () => {
    workInProgressFiberRoot = {
      ...currentWorkOfUnit,
      alternate: currentWorkOfUnit,
    };
    nextWorkOfUnit = workInProgressFiberRoot;
  };
}

function workLoop(deadline) {
  let shouldYield = false;
  while (!shouldYield && nextWorkOfUnit) {
    nextWorkOfUnit /** nextWorkOfUnit */ = performWorkOfUnit(nextWorkOfUnit);
    if (workInProgressFiberRoot?.sibling === nextWorkOfUnit) {
      nextWorkOfUnit = null;
    }
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextWorkOfUnit && workInProgressFiberRoot) {
    commitWorkInProgressFiberRoot();
  }
  requestIdleCallback(workLoop);
}

function commitWorkInProgressFiberRoot() {
  deletions.forEach(commitDeletion);
  // 统一提交
  commitWorkOfUnit(workInProgressFiberRoot.child);
  commitEffectHooks();
  currentFiberRoot = workInProgressFiberRoot;
  workInProgressFiberRoot = null;
  deletions = [];
}

function commitEffectHooks() {
  const runCallbacks = (workOfUnit) => {
    if (!workOfUnit) {
      return;
    }
    if (!workOfUnit.alternate) {
      workOfUnit.effectHooks?.forEach((hook) => {
        hook.cleanup = hook.callback();
      });
    } else {
      workOfUnit.effectHooks?.forEach((newHook, i) => {
        if (!newHook.deps.length) {
          return;
        }
        const oldHook = workOfUnit.alternate.effectHooks[i];
        const shouldCall = oldHook?.deps.some((oldDep, j) => {
          return oldDep !== newHook.deps[j];
        });
        if (shouldCall) {
          newHook.cleanup = newHook.callback();
        }
      });
    }
    runCallbacks(workOfUnit.child);
    runCallbacks(workOfUnit.sibling);
  };

  const runCleanups = (workOfUnit) => {
    if (!workOfUnit) {
      return;
    }
    workOfUnit.alternate?.effectHooks?.forEach((hook) => {
      if (hook.deps.length && hook.cleanup) {
        hook.cleanup();
      }
    });
    runCleanups(workOfUnit.child);
    runCleanups(workOfUnit.sibling);
  };
  runCleanups(workInProgressFiberRoot);
  runCallbacks(workInProgressFiberRoot);
}

function commitDeletion(workOfUnit) {
  if (!workOfUnit) {
    return;
  }
  if (workOfUnit.dom) {
    let fiberParent = workOfUnit.parent;
    while (!fiberParent.dom) {
      fiberParent = fiberParent.parent;
    }
    fiberParent.dom.removeChild(workOfUnit.dom);
  } else {
    commitDeletion(workOfUnit.child);
  }
}

function commitWorkOfUnit(workOfUnit) {
  if (!workOfUnit) {
    return;
  }
  let fiberParent = workOfUnit.parent;
  while (!fiberParent.dom) {
    fiberParent = fiberParent.parent;
  }
  if (workOfUnit.effectTag === "update") {
    updateDom(workOfUnit.dom, workOfUnit.props, workOfUnit.alternate?.props);
  }
  if (workOfUnit.effectTag === "placement" && workOfUnit.dom) {
    fiberParent.dom.append(workOfUnit.dom);
  }
  commitWorkOfUnit(workOfUnit.child);
  commitWorkOfUnit(workOfUnit.sibling);
}

function createDom(type) {
  return type === "TEXT_ELEMENT"
    ? document.createTextNode("")
    : document.createElement(type);
}

function reconcileChildren(workOfUnit, children) {
  let oldChildWorkOfUnit = workOfUnit.alternate?.child;
  let preChildWorkOfUnit = null;
  for (const childWorkOfUnit of children) {
    let newChildWorkOfUnit = null;

    const isSameType =
      oldChildWorkOfUnit && oldChildWorkOfUnit.type === childWorkOfUnit.type;
    if (isSameType) {
      // update
      newChildWorkOfUnit = {
        type: oldChildWorkOfUnit.type, // oldChildWorkOfUnit.type
        props: childWorkOfUnit.props,
        dom: oldChildWorkOfUnit.dom, // 复用 dom
        parent: workOfUnit,
        child: null,
        sibling: null,
        effectTag: "update",
        alternate: oldChildWorkOfUnit,
      };
    } else {
      // placement
      if (childWorkOfUnit) {
        newChildWorkOfUnit = {
          type: childWorkOfUnit.type,
          props: childWorkOfUnit.props,
          dom: null,
          parent: workOfUnit,
          child: null,
          sibling: null,
          effectTag: "placement",
        };
      }
      if (oldChildWorkOfUnit) {
        deletions.push(oldChildWorkOfUnit);
      }
    }
    if (oldChildWorkOfUnit) {
      oldChildWorkOfUnit = oldChildWorkOfUnit.sibling;
    }
    if (!preChildWorkOfUnit) {
      // todo: if (index === 0)
      workOfUnit.child = newChildWorkOfUnit;
    } else {
      preChildWorkOfUnit.sibling = newChildWorkOfUnit;
    }
    if (newChildWorkOfUnit) {
      preChildWorkOfUnit = newChildWorkOfUnit;
    }
  }

  while (oldChildWorkOfUnit) {
    deletions.push(oldChildWorkOfUnit);
    oldChildWorkOfUnit = oldChildWorkOfUnit.sibling;
  }
}

function updateDom(dom, newProps, oldProps = {}) {
  for (const key of Object.keys(oldProps)) {
    if (key !== "children" && !(key in newProps)) {
      if (key === "className") {
        dom.removeAttribute("class");
        continue;
      }
      if (key === "htmlFor") {
        dom.removeAttribute("for");
        continue;
      }
      dom.removeAttribute(key);
    }
  }

  for (const key of Object.keys(newProps)) {
    if (key === "children" || oldProps[key] === newProps[key]) {
      continue;
    }
    if (key.startsWith("on")) {
      const eventType = key.slice(2).toLowerCase();
      dom.removeEventListener(eventType, oldProps[key]);
      dom.addEventListener(eventType, newProps[key]);
    } else {
      dom[key] = newProps[key];
    }
  }
}

// let stateHooks = null;
// let stateHookIndex = null;

function updateFunctionComponent(workOfUnit) {
  workInProgressFiberNode = workOfUnit;
  workOfUnit.stateHooks = [];
  workOfUnit.stateHookIndex = 0;
  workOfUnit.effectHooks = [];
  const children = [workOfUnit.type(workOfUnit.props)];
  reconcileChildren(workOfUnit, children);
}

function updateHostComponent(workOfUnit) {
  if (!workOfUnit.dom) {
    const dom = createDom(workOfUnit.type);
    updateDom(dom, workOfUnit.props);
    workOfUnit.dom = dom;
  }
  const children = workOfUnit.props.children;
  reconcileChildren(workOfUnit, children);
}

function performWorkOfUnit(workOfUnit) {
  const isFunctionComponent = typeof workOfUnit.type === "function";
  if (isFunctionComponent) {
    updateFunctionComponent(workOfUnit);
  } else {
    updateHostComponent(workOfUnit);
  }

  if (workOfUnit.child) {
    return workOfUnit.child;
  }

  let nextFiberNode = workOfUnit;
  while (nextFiberNode) {
    if (nextFiberNode.sibling) {
      return nextFiberNode.sibling;
    }
    nextFiberNode = nextFiberNode.parent;
  }
}

function useState(initialValue) {
  let currentWorkOfUnit = workInProgressFiberNode;
  const oldStateHook =
    currentWorkOfUnit.alternate?.stateHooks?.[currentWorkOfUnit.stateHookIndex];
  const hook = {
    state: oldStateHook ? oldStateHook.state : initialValue,
    // oldStateHook?.queue && [],
    // oldStateHook?.queue ?? [],
    queue: [],
  };
  oldStateHook?.queue?.forEach((action) => {
    hook.state = action(hook.state);
  });
  // hook.queue = [];

  currentWorkOfUnit.stateHooks.push(hook);
  currentWorkOfUnit.stateHookIndex++;
  const setState = (action) => {
    const eagerState =
      typeof action === "function" ? action(hook.state) : action;
    if (eagerState === hook.state) {
      return;
    }
    hook.queue.push(typeof action === "function" ? action : () => action);
    workInProgressFiberRoot = {
      ...currentWorkOfUnit,
      alternate: currentWorkOfUnit,
    };
    nextWorkOfUnit = workInProgressFiberRoot;
  };
  return [hook.state, setState];
}

function useEffect(callback, deps) {
  let currentWorkOfUnit = workInProgressFiberNode;
  const hook = {
    callback,
    deps,
    cleanup: null,
  };
  currentWorkOfUnit.effectHooks.push(hook);
}

requestIdleCallback(workLoop);

const React = {
  render,
  createElement,
  useState,
  useEffect,
};

export default React;
