const http = require('http');
const Koa = require('koa');
const cors = require('@koa/cors');
const koaBody = require('koa-body').default;
const WS = require('ws');

const app = new Koa();

app.use(koaBody());
app.use(cors());

app.use((ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    next();
    return;
  }

  const headers = { 'Access-Control-Allow-Origin': '*', };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      next();
      return;
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }

    ctx.response.status = 204;
  }
});

const server = http.createServer(app.callback());
const port = 7071;

const wsServer = new WS.Server({
    server
});

let users = [];
let chat = [];
let backendMessage;

wsServer.on('connection', (ws) => {
  ws.on('message', (message) => {
    const frontendMessage = JSON.parse(message);
    if (frontendMessage.newuser) {
      if (users.includes(frontendMessage.newuser)) {
        backendMessage = JSON.stringify({
          'error': 'Nickname is busy'
        })
        ws.send(backendMessage);
      } else {
        users.push(frontendMessage.newuser);
        backendMessage = JSON.stringify({
          'action': 'open chat',
          'nickname': frontendMessage.newuser,
        })
        ws.send(backendMessage);
        backendMessage = JSON.stringify({
          'action': 'update user list',
          'users': users
        })
        sendMessageToAllClients(backendMessage);
        backendMessage = JSON.stringify({
          'action': 'update chat',
          'chat': chat
        })
        ws.send(backendMessage);
      }
    } else if (frontendMessage.action === 'user left') {
      users = users.filter((nickname) => nickname !== frontendMessage.nickname);
      backendMessage = JSON.stringify({
        'action': 'update user list',
        'users': users
      })
      sendMessageToAllClients(backendMessage);
    } else if (frontendMessage.action === 'new message') {
      chat.push({
        nickname: frontendMessage.nickname,
        date: frontendMessage.date,
        message: frontendMessage.message
      })
      backendMessage = JSON.stringify({
        'action': 'update chat',
        'chat': chat
      })
      sendMessageToAllClients(backendMessage);
    }
  });
});

function sendMessageToAllClients(backendMessage) {
  Array.from(wsServer.clients)
    .filter(client => client.readyState === WS.OPEN)
    .forEach(client => client.send(backendMessage));
}

server.listen(port, (err) => {
  if (err) {
    console.log(err);
    return;
  }
  console.log('Server is listening to '+ port);
})
