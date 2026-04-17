#include <napi.h>

#include <algorithm>
#include <vector>

template <typename Compare>
void sift_down(std::vector<double> &heap, size_t index, Compare cmp) {
  size_t size = heap.size();
  while (true) {
    size_t smallest = index;
    size_t left = 2 * index + 1;
    size_t right = 2 * index + 2;
    if (left < size && cmp(heap[left], heap[smallest])) {
      smallest = left;
    }
    if (right < size && cmp(heap[right], heap[smallest])) {
      smallest = right;
    }
    if (smallest == index) {
      break;
    }
    std::swap(heap[index], heap[smallest]);
    index = smallest;
  }
}

template <typename Compare>
void sift_up(std::vector<double> &heap, size_t index, Compare cmp) {
  while (index > 0) {
    size_t parent = (index - 1) / 2;
    if (!cmp(heap[index], heap[parent]))
      break;
    std::swap(heap[index], heap[parent]);
    index = parent;
  }
}

std::vector<double> ArrayToVector(Napi::Array arr) {
  std::vector<double> vec;
  vec.reserve(arr.Length());
  for (uint32_t i = 0; i < arr.Length(); i++) {
    vec.push_back(arr.Get(i).As<Napi::Number>().DoubleValue());
  }
  return vec;
}

class JsComparator {
public:
  Napi::Env env;
  Napi::Function compareFn;
  JsComparator(Napi::Env e, Napi::Function fn) : env(e), compareFn(fn) {}

  bool operator()(double a, double b) const {
    Napi::Value result =
        compareFn.Call({Napi::Number::New(env, a), Napi::Number::New(env, b)});
    return result.As<Napi::Number>().Int32Value() < 0;
  }
};

Napi::Value Heapify(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsFunction()) {
    Napi::TypeError::New(env, "Expected (array, compareFunction)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Array arr = info[0].As<Napi::Array>();
  Napi::Function compareFn = info[1].As<Napi::Function>();
  std::vector<double> heap = ArrayToVector(arr);
  JsComparator cmp(env, compareFn);
  if (heap.size() > 1) {
    for (size_t i = heap.size() / 2; i-- > 0;) {
      sift_down(heap, i, cmp);
    }
  }
  for (size_t i = 0; i < heap.size(); i++) {
    arr.Set(i, Napi::Number::New(env, heap[i]));
  }
  return arr;
}

Napi::Value Heappop(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsFunction()) {
    Napi::TypeError::New(env, "Expected (array, compareFunction)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Array arr = info[0].As<Napi::Array>();
  Napi::Function compareFn = info[1].As<Napi::Function>();
  if (arr.Length() == 0) {
    Napi::Error::New(env, "heap is empty").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::vector<double> heap = ArrayToVector(arr);
  JsComparator cmp(env, compareFn);
  double result = heap[0];
  heap[0] = heap.back();
  heap.pop_back();
  if (!heap.empty()) {
    sift_down(heap, 0, cmp);
  }
  uint32_t newLen = heap.size();
  for (size_t i = 0; i < newLen; i++) {
    arr.Set(i, Napi::Number::New(env, heap[i]));
  }
  Napi::Object arrObj = arr.As<Napi::Object>();
  arrObj.Set("length", Napi::Number::New(env, newLen));
  return Napi::Number::New(env, result);
}

Napi::Value Heappush(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsArray() || !info[1].IsNumber() ||
      !info[2].IsFunction()) {
    Napi::TypeError::New(env, "Expected (array, number, compareFunction)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Array arr = info[0].As<Napi::Array>();
  double item = info[1].As<Napi::Number>().DoubleValue();
  Napi::Function compareFn = info[2].As<Napi::Function>();
  std::vector<double> heap = ArrayToVector(arr);
  JsComparator cmp(env, compareFn);
  heap.push_back(item);
  sift_up(heap, heap.size() - 1, cmp);
  for (size_t i = 0; i < heap.size(); i++) {
    arr.Set(i, Napi::Number::New(env, heap[i]));
  }
  return env.Undefined();
}

Napi::Value Heappushpop(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsArray() || !info[1].IsNumber() ||
      !info[2].IsFunction()) {
    Napi::TypeError::New(env, "Expected (array, number, compareFunction)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Array arr = info[0].As<Napi::Array>();
  double item = info[1].As<Napi::Number>().DoubleValue();
  Napi::Function compareFn = info[2].As<Napi::Function>();
  std::vector<double> heap = ArrayToVector(arr);
  JsComparator cmp(env, compareFn);
  if (heap.empty() || cmp(item, heap[0]) || item == heap[0]) {
    return Napi::Number::New(env, item);
  }
  double result = heap[0];
  heap[0] = item;
  sift_down(heap, 0, cmp);
  for (size_t i = 0; i < heap.size(); i++) {
    arr.Set(i, Napi::Number::New(env, heap[i]));
  }
  return Napi::Number::New(env, result);
}

Napi::Value Heapreplace(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsArray() || !info[1].IsNumber() ||
      !info[2].IsFunction()) {
    Napi::TypeError::New(env, "Expected (array, number, compareFunction)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Array arr = info[0].As<Napi::Array>();
  double item = info[1].As<Napi::Number>().DoubleValue();
  Napi::Function compareFn = info[2].As<Napi::Function>();
  if (arr.Length() == 0) {
    Napi::Error::New(env, "heap is empty").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::vector<double> heap = ArrayToVector(arr);
  JsComparator cmp(env, compareFn);
  double result = heap[0];
  heap[0] = item;
  sift_down(heap, 0, cmp);
  for (size_t i = 0; i < heap.size(); i++) {
    arr.Set(i, Napi::Number::New(env, heap[i]));
  }
  return Napi::Number::New(env, result);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("heapify", Napi::Function::New(env, Heapify));
  exports.Set("heappop", Napi::Function::New(env, Heappop));
  exports.Set("heappush", Napi::Function::New(env, Heappush));
  exports.Set("heappushpop", Napi::Function::New(env, Heappushpop));
  exports.Set("heapreplace", Napi::Function::New(env, Heapreplace));
  return exports;
}

NODE_API_MODULE(heap, Init)
