'use strict'

const fs = require('fs')
const path = require('path');

const { readSTL } = require('./modules/stlReader.js')

const AeroModel = require('./modules/aeroModel.js')
const AtmoModel = require('./modules/atmoModel.js')

const atmosphereData = require('./atmo/earth_atmo.json')
const { active_var, vehicles } = require("./init_data.json")

const { vehicle_data, flight_parameters } = vehicles[active_var]

if (flight_parameters.AV.length == 0) {
    let delta = 0.1
    flight_parameters.AV = []
    for (let i = 0.0; i < 180; i += delta) {
        flight_parameters.AV.push(i.toFixed(2))
    }
}

const activeAtmo = new AtmoModel()
activeAtmo.initAtmo(atmosphereData)

const saveResults = function (model, adxTab, adxPrms) {
    const { H, MV, AV, rad } = flight_parameters
    const { vehicle_name, area } = vehicle_data


    // Папка с результами расчёта
    let d = new Date();
    let year = d.getFullYear()
    let month = d.getMonth()
    let day = d.getDay()
    let hour = d.getHours()
    let minut = d.getMinutes()
    const resFolder = `./grafics/${vehicle_name}_${year}-${month}-${day}_${hour}.${minut}/`
    fs.mkdirSync(resFolder, { recursive: true }, (err) => {
        if (err) throw err;
    });

    const nA = AV.length

    let isFirst = true
    for (let j = 0; j < nA; j++) {
        let alpha = rad ? AV[j] : (AV[j] * Math.PI / 180)
        let CTA = Math.cos(alpha)
        let STA = Math.sin(alpha)
        let res = adxTab[0][j]
        res.Cx = -res.Cx;

        let Cxa = res.Cx * CTA + res.Cy * STA + res.CxF
        let Cya = res.Cy * CTA - res.Cx * STA
        let K = Cya / Cxa


        let alpha_deg = rad ? (AV[j] * 180 / Math.PI) : AV[j]

        let res_str = {}
        res_str["X_force"] = `${alpha_deg} -> ${res.X_force}\n`
        res_str["Y_force"] = `${alpha_deg} -> ${res.Y_force}\n`

        res_str["Cx"] = `${alpha_deg} -> ${res.Cx}\n`
        res_str["Cy"] = `${alpha_deg} -> ${res.Cy}\n`

        res_str["Cxa"] = `${alpha_deg} -> ${Cxa}\n`
        res_str["Cya"] = `${alpha_deg} -> ${Cya}\n`
        res_str["K"] = `${alpha_deg} -> ${K}\n`

        // Если это первый проход
        if (isFirst) {
            // Опускаем флаг
            isFirst = false
            // Задаём заголовки файлов расчёта
            for (const [param, value] of Object.entries(res_str)) {
                let header_str = `name: ${param}\ntype: 2D\nx: alpha | deg\ny: ${param}  | \n\ncoords:\n`
                let file_param = path.join(resFolder, param) + ".txt"
                fs.writeFileSync(file_param, header_str, { flag: 'a' })
            }
        }

        for (const [param, value] of Object.entries(res_str)) {
            let file_param = path.join(resFolder, param) + ".txt"
            fs.writeFileSync(file_param, value, { flag: 'a' })
        }

    }

    const resultHeader = `Model : "./data/${vehicle_data.vehicle_name}.stl"\n`
    const geometryStr = [
        'geometry:',
        `\tlength: ${model.size} m`,
        `\theight: ${model.height} m`,
        `\twidth:  ${model.width} m`,
        `\tSmid:  ${area} m2`].join('\n') + "\n"
    const HPoints = `H:   ${H} m`
    const machPoints = `Mach: ${MV.map(Mach => Mach).join('\t')}`
    const renoldsPoints = `Re:   ${adxPrms.map(({ reynolds }) => reynolds).join('\t')}`
    const knudsenPoints = `Kn:   ${adxPrms.map(({ knudsen }) => knudsen).join('\t')}`


    const log_res = [geometryStr,
                     HPoints,
                     machPoints,
                     renoldsPoints,
                     knudsenPoints].join('\n') + "\n"

    console.log(log_res)

    const res_txt = resultHeader + "\n\n" + log_res
    let res_file = path.join(resFolder, "res.txt")
    fs.writeFileSync(res_file, res_txt, { flag: 'a' })

    console.log('aerodinamic data ready to output;\n')

}

const processADX = function (geometry) {
    const { H, MV, AV, rad } = flight_parameters
    const { area } = vehicle_data

    // Параметры воздушного потока на высоте H
    activeAtmo.setupIndex(H)
    const test_flow = activeAtmo.getAtmo(H)

    // Модель обтекания воздухом
    const model = new AeroModel()

    model.init(geometry, area)
    console.log('geometry ready\n')
    // Расчёт аэродинамических параметров
    const { adxTable, adxParameters } = model.calcTable(
        MV,
        rad ? AV : AV.map(alpha => alpha * Math.PI / 180),
        0,
        test_flow
    )

    saveResults(model, adxTable, adxParameters)
}

readSTL(vehicle_data, processADX)