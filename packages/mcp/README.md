## 缺陷: 服务端没有对登录进行限制

- 没有失败次数阈值（账号/IP 维度）
- 没有速率限制（rate limit）
- 用户账号密码过于简单
- 直接使用 md5 编码 password，属于弱口令，没有加盐
- sql 执行失败时直接回显错误码和错误信息

安全隐患：攻击者可以发送高频登录请求，猜测密码

思考: 对于 express, 一个推荐的做法是使用限流器

```ts
import express from "express";
import rateLimit from "express-rate-limit";
const app = express();
const limiter = rateLimit({
  windowMs: 60_000, // 1 分钟
  limit: 60, // 最多 60 次
  standardHeaders: true, // 返回 RateLimit-* 新响应头
  legacyHeaders: false, // 不返回 X-RateLimit-* 旧响应头
  message: { error: "Too Many Requests" }, // 限流时的响应体
});
// 全局限流
app.use(limiter);
// 只限流指定接口 (登录/注册)
// app.post("/login", limiter, (req, res) => res.json({ ok: true }));

app.listen(3000, "0.0.0.0");
```

- 用户注册时可以使用正则和 zod 校验密码复杂度
- 服务端配置限流器；登录失败一定次数后，冷却该账号/IP 的登录功能

## 缺陷: 验证码没有有效期

思考：设置验证码有效期；用户验证码校验成功、验证码过期、或者刷新验证码，都需要销毁

## 缺陷: 验证码仅在前端校验，可以绕过

安全隐患：攻击者可以使用脚本等，绕过前端的验证码校验，发送高频登录请求，猜测密码

思考：服务端必须校验验证码

一些有效的 hack 方法是

- 使用脚本直接发送 POST 请求，不需要验证码
- 移除表单的 onsubmit 属性，这样就不需要输入验证码了

```js
// 使用脚本直接发送 POST 请求
const formData = new FormData();
formData.append("username", "admin");
formData.append("password", "pass");
formData.append("submit", "1");

fetch("http://localhost:8082/vul/burteforce/bf_client", {
  method: "POST",
  body: formData,
  headers: {
    "Content-Type": "multipart/form-data",
  },
})
  .then((res) => res.text())
  .then(console.log);

// 移除表单的 onsubmit 属性
const form = document.querySelector("form");
form.onsubmit = null;
```

## 缺陷

- 使用 GET 方法明文传输 username 和 password，直接触发 chrome 警告：更改您的密码！username 和 password 会保存在地址栏、历史记录、网关日志等
- 缺少 CSRF 防护

思考

- 必须使用 POST 方法
- AI 生成：服务端预防 CSRF
  - 使用 Anti-CSRF Token（同步令牌模式）
    - 如果身份认证使用 Authorization: Bearer <token> 并且不依赖 Cookie，则不需要 Anti-CSRF Token（同步令牌模式），但需要预防 XSS
    - 服务端生成 token，前端在有副作用请求时（POST/PUT/PATCH/DELETE）携带 X-CSRF-Token: <token> 请求头
  - 配置 Cookie 的 SameSite 属性
    - SameSite=Lax 不允许跨站 POST 请求或 xhr/fetch 时携带 Cookie
    - SameSite=Strict 严格模式，不允许任何跨站请求携带 Cookie
- 使用 HTTPS，有 SSL/TLS 安全层，可以证明身份合法性，预防中间人攻击 （MITM， Man-in-the-Middle）

```js
res.cookie("session_id", "...", {
  // httponly: httponly=true 时
  // 服务器可以通过 Set-Cookie 响应头字段设置 cookie
  // 但客户端 JS 不能读写 cookie
  // 以防止 XSS 攻击截获 cookie
  httpOnly: true,

  // secure: secure=true 时
  // 只有使用 HTTPS 的 cookie 才会上传到服务器
  // 使用 HTTP 的 cookie 不会上传到服务器
  secure: true,
  sameSite: "lax", // 或 'strict'
});
```

## 缺陷

- 使用 GET 方法明文传输用户资料
- 缺少 CSRF 防护
- 可能导致存储型 XSS
  - 什么是存储型 XSS：也称为持久型 XSS， 存储型 XSS 的恶意代码存储在数据库中， 最严重
  - 修改后的字段值会被写入数据库，并在页面模板中直接插入到 HTML 属性值中，如果页面中没有转义，可能导致存储型 XSS

| raw | escaped          |
| --- | ---------------- |
| &   | &amp;            |
| <   | &lt;             |
| >   | &gt;             |
| "   | &quot;           |
| '   | &#039; 或 &apos; |

## sql 注入

复现

```js
const sql = `SELECT username, email FROM member WHERE id = '${id}'`;

// 如果 id 是 ->' OR 1=1 -- <-
// 拼接得到
// SELECT username, email FROM member WHERE id = '' or 1=1 -- '

// 如果 id 是 ->' union select database(), user() -- <-
// 拼接得到
// SELECT username, email FROM member WHERE id = '' union select database(), user() -- '
```

复现

```js
const sql = `SELECT id, email FROM member WHERE username = '${name}'`;

// 如果 name 是 ->' OR 1=1 -- <-
// 拼接得到
// SELECT id, email FROM member WHERE username = '' OR 1=1 -- '
// http://localhost:8082/vul/sqli/sqli_str.php?name=' or 1=1 -- &submit=1

// 如果 name 是 ->' union select database(), user() -- <-
// 拼接得到
// SELECT id, email FROM member WHERE username = '' union select database(), user() -- '
// http://localhost:8082/vul/sqli/sqli_str.php?name=' union select database(), user() -- &submit=1

const sql2 = `SELECT id, email FROM member WHERE username = ('${name}')`;

// 如果 name 是 ->1') OR 1=1 -- <-
// 拼接得到
// SELECT id, email FROM member WHERE username = ('1') OR 1=1 -- ')
// http://localhost:8082/vul/sqli/sqli_x.php?name=1') OR 1=1 -- &submit=1
```

复现

```js
const sql = `DELETE FROM message WHERE id = '${id}'`;

// 如果 id 是 ->' or 1=1 -- <-
// 拼接得到
// DELETE FROM message WHERE id = '' or 1=1 -- '
// 直接删除全表！
```

复现

```js
const sql = `SELECT username, id, email FROM member WHERE username LIKE '%${name}%'`;

// 如果 name 是 ->%' or 1=1 -- <-
// 拼接得到
// SELECT username, id, email FROM member WHERE username LIKE '%%' or 1=1 -- %'
// http://localhost:8082/vul/sqli/sqli_search.php?name=%' or 1=1 -- &submit=1
```

## 缺陷

- sql 注入
- 查询结果直接插入到 HTML，可能导致存储型 XSS

思考

- 使用参数化查询 （Prepared Statement），例如 mysql2
  - 参数化查询分为两步：prepare 预编译、execute 执行
- react <div dangerouslySetInnerHTML={...} /> vue v-html 也可能导致 XSS，需要转义，尽量少用

```js
const sql = "SELECT id, email FROM member WHERE username = (?)"; // 使用占位符 ?
const [rows] = await connection.execute(sql, [name]);
```

## RCE

思考

- 项目中的场景是，该接口将用户输入拼接到 ping 命令后，使用 shell_exec() 执行，会导致 RCE， Remote Code Execution 远程命令执行，和之前的 RSC 漏洞 https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components 性质相同
- JS 的 eval() 将传入的字符串作为代码执行，使用 eval() 可能导致 XSS，不要使用 eval()

```js
// http://localhost:8082?cmd=alert(document.cookie)
const urlParams = new URLSearchParams(window.location.search);
const cmdInput = urlParams.get("cmd");
const result = eval(cmdInput);
document.body.innerText = result;
```

## 任意文件读写

总结：服务端允许用户读写文件，但没有限制用户只能读写指定目录的文件，用户可以使用 ../../../ 跳跃

```js
import express from "express";
import { join } from "path";
const app = express();

const ALLOWED_DIR = join(__dirname, "public/images");

app.get("/download", (req, res) => {
  const filename = req.query.filename;
  const filePath = join(__dirname, "public/images", filename);

  // 限制用户只能读写指定目录的文件
  const filePath = join(ALLOWED_DIR, filename);
  if (!filePath.startsWith(ALLOWED_DIR)) {
    return res.status(403).send("Unauthorized Access");
  }

  res.download(filePath);
});
```

## 越权

总结：服务端只检查用户是否登录，没有检查用户是否有权访问数据

思考

- 始终从 session/token 中获取当前用户的身份
- 最小权限控制

```js
// 错误实践：服务端只检查用户是否登录，没有检查用户是否有权访问数据
app.get("/api/profile", requireLogin, (req, res) => {
  // 例如，当前登录用户是 John_Doe
  // John_Doe 访问 /api/profile?username=Jane_Doe 越权访问 Jane_Doe 的数据（水平越权）
  const targetUser = req.query.username;
  const userData = db.findUser(targetUser);
  res.json(userData);
});

// 正确实践：始终从 session/token 中获取当前用户的身份信息
app.get("/api/profile", requireLogin, (req, res) => {
  const currentUser = req.session.username;
  const userData = db.findUser(currentUser);
  res.json(userData);
});

// 错误实践：只要登录就能访问 /api/admin/delete-user 接口
app.post("/api/admin/delete-user", requireLogin, (req, res) => {
  // role="user" 的 Jane_Doe 越权删除指定 ID 的用户（垂直越权）
  db.deleteUser(req.body.id);
  res.send("Delete OK");
});

// 正确实践：添加 requireAdmin 中间件
function requireAdmin(req, res, next) {
  if (req.session.user.role !== "admin") {
    return res.status(403).send("No permission");
  }
  next();
}

app.post("/api/admin/delete-user", requireLogin, requireAdmin, (req, res) => {
  db.deleteUser(req.body.id);
  res.send("Delete OK");
});
```

## 敏感信息泄露

- 使用 GET 方法明文传输 username 和 password，直接触发 chrome 警告：更改您的密码！username 和 password 会保存在地址栏、历史记录等
- 返回的错误信息中区分账号错误和密码错误，属于错误实践，方便攻击者猜测账号和密码
- 直接使用 md5 编码 password，属于弱口令，没有加盐
- 将 username 和 md5 编码的 password 写入 Cookie，并且未设置 httpOnly、Secure、SameSite
- 每次请求时缺少服务端鉴权
  思考
- 必须用 POST 方法
- 统一错误信息：账号或密码错误
- 不要用 Cookie 存储身份信息，使用服务端会话 session 或 jwt 存储身份信息
- Cookie 可以设置 httpOnly、Secure、SameSite
- 每次请求都需要服务端鉴权

## Open Redirect 开放重定向漏洞

场景：跳转链接是 https://dummy.com/login?redirect=https://evil.com

如果服务器是这样写的

```js
app.get("/login", (req, res) => {
  const target = req.query.redirect;
  // 直接重定向
  res.redirect(target);
});
```

则用户会被重定向到钓鱼网站 https://evil.com

思考: 必须限制跳转的目的地址：通常是本站域名，或者白名单中的域名

```js
app.get("/login", (req, res) => {
  const target = req.query.redirect;
  try {
    const url = new URL(target, "http://dummy.com");
    // 检查是否为本站域名
    if (target.startsWith("/") && !target.startsWith("//")) {
      return res.redirect(target);
    }
    // 检查是否为白名单中的域名
    if (
      url.hostname === "trusted.com" ||
      url.hostname.endsWith(".trusted.com")
    ) {
      return res.redirect(target);
    }
  } catch (e) {
    // URL 格式错误
  }
  res.redirect("/");
});
```
