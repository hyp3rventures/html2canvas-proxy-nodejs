const express = require("express");
const url = require("url");
const cors = require("cors");
const qs = require("qs");
const request = require("request");
const queue = require("async/queue");

module.exports = function() {
  const app = express.Router();
  const MAX_RETRIES = 10;
  const defaultImageUrl =
    "https://s3.amazonaws.com/static-hyper-co/core-app/transparent.png";

  function validUrl(req, res, next) {
    req.query = req.query || qs.parse(url.parse(req.url).query);
    if (req.query.url == null) {
      next(new Error("No url specified"));
    } else if (
      typeof req.query.url !== "string" ||
      url.parse(req.query.url).host === null
    ) {
      next(new Error("Invalid url specified: " + req.query.url));
    } else {
      next();
    }
  }

  app.use(cors());
  app.get("/", validUrl, function(req, res, next) {
    if (typeof req.query.callback === "string") {
      request({ url: req.query.url, encoding: "binary" }, function(
        error,
        response,
        body
      ) {
        if (error) {
          return next(error);
        }
        res.jsonp({
          content: new Buffer(body, "binary").toString("base64"),
          type: response.headers["content-type"]
        });
      });
    } else {
      req.pipe(
        request
          .get(req.query.url)
          .on("response", response => response.pipe(res))
          .on("error", error =>
            req.pipe(request.get(defaultImageUrl)).pipe(res)
          )
      );
    }
  });

  return app;
};
