const fs = require('fs')
const path = require('path')

module.exports = {
  readFiles (rootFolder, files) {
    return files
      .filter(f => fs.existsSync(path.join(rootFolder, f)))
      .map(f => ({
        fileName: f,
        data: fs.readFileSync(path.join(rootFolder, f))
      }))
  },
  readAllFilesInFolder (rootFolder, folder) {
    const realPath = path.join(rootFolder, folder || '')
    return fs.readdirSync(realPath).flatMap(file => {
      const fRelativePath = path.join(folder || '', file)
      const fAbsolutePath = path.join(rootFolder, fRelativePath)
      if (fs.lstatSync(fAbsolutePath).isDirectory()) {
        return module.exports.readAllFilesInFolder(rootFolder, fRelativePath)
      } else {
        return {
          fileName: fRelativePath,
          data: fs.readFileSync(fAbsolutePath)
        }
      }
    })
  }
}
