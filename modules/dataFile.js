const fs = require('fs')
const path = require('path');

function cur_time_folder() {
    let d = new Date();
    let year = d.getFullYear()
    let month = d.getMonth()
    let day = d.getDay()
    let hour = d.getHours()
    let minut = d.getMinutes()
    return `${year}-${month}-${day}_${hour}.${minut}`
}

function copyFilesSync(sourceDir, targetDir) {
    const files = fs.readdirSync(sourceDir);

    files.forEach(file => {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        const stat = fs.statSync(sourcePath);

        if (stat.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        } else if (stat.isDirectory()) {
            fs.mkdirSync(targetPath);
            copyFilesSync(sourcePath, targetPath);
        }
    });
}

module.exports = {
    prepareRes: function (vehicle_name) {
        let res_folder = `./grafics/${vehicle_name}_${cur_time_folder()}/`
        fs.mkdirSync(res_folder, { recursive: true }, (err) => {
            if (err) throw err;
        });
        copyFilesSync("templates", res_folder);
        res = {
            "Cx": path.join(res_folder, "Cx.txt"),
            "Cxa": path.join(res_folder, "Cxa.txt"),
            "Cy": path.join(res_folder, "Cy.txt"),
            "Cya": path.join(res_folder, "Cya.txt")
        }
        return res;
    }
}