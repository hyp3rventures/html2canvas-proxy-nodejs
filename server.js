const express = require("express");
const url = require("url");
const cors = require("cors");
const qs = require("qs");
const request = require("request");
const queue = require("async/queue");

module.exports = function() {
  const app = express.Router();
  const MAX_RETRIES = 5;

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
    let retryCount = 0;
    let success = false;

    if (typeof req.query.callback === "string") {
      do {
        queue(function() {
          request({ url: req.query.url, encoding: "binary" }, function(
            error,
            response,
            body
          ) {
            if (error) {
              retryCount += 1;
            } else {
              success = true;

              res.jsonp({
                content: new Buffer(body, "binary").toString("base64"),
                type: response.headers["content-type"]
              });
            }
          });
        }, 2);
      } while (retryCount < MAX_RETRIES && !success);

      // When retry count has been completed and we don't have success fallback to 500
      // TODO: Make the fallback to a default image.
      if (!success) {
        return next(error);
      }
    } else {
      req.pipe(request(req.query.url).on("error", next)).pipe(res);
    }
  });

  return app;
};
