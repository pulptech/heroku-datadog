module.exports = {
  createDatadogTags: (tags) => Object.keys(tags).map((tag) => `${tag}:${tags[tag]}`)
};
