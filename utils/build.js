// run snowpack build
// commit the changes in /dist
// push up submodule
const exec = require('@actions/exec');
const fs = require('fs-extra')

async function buildAndDist() {
  console.log("🎉 Building assets")
  await exec.exec('npm run build')
  console.log("🚚 Moving to dist")
  await fs.copySync('./build', './dist')
}

buildAndDist();