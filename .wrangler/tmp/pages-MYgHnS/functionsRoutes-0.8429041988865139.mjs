import { onRequest as __api_whatsapp_js_onRequest } from "C:\\Users\\matan\\VsCode\\test\\dr-rinat-site\\functions\\api\\whatsapp.js"

export const routes = [
    {
      routePath: "/api/whatsapp",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_whatsapp_js_onRequest],
    },
  ]