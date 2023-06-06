'use strict'

const fs = require('fs')
const { prepareRes } = require('./modules/dataFile.js')

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

const prepareADXResult = function (adxTab, adxPrms, MV, AV, vehicle_name, area, rad) {
    let res = prepareRes(vehicle_name)

    const nA = AV.length

    for (let j = 0; j < nA; j++) {
        let alpha = rad ? AV[j] : (AV[j] * Math.PI / 180)
        let CTA = Math.cos(alpha)
        let STA = Math.sin(alpha)
        let {Cx, Cy, Cz, CxF } = adxTab[0][j]
        Cx = -Cx;
        let Cxa = Cx * CTA + Cy * STA + CxF
        let Cya = Cy * CTA - Cx * STA
        let K = Cya / Cxa

        let alpha_deg = rad ? (AV[j] * 180 / Math.PI) : AV[j]

        let Cx_str = `${alpha_deg} -> ${Cx}\n`
        let Cxa_str = `${alpha_deg} -> ${Cxa}\n`
        let Cy_str = `${alpha_deg} -> ${Cy}\n`
        let Cya_str = `${alpha_deg} -> ${Cya}\n`
        let K_str = `${alpha_deg} -> ${K}\n`

        fs.writeFileSync(res["Cx"], Cx_str, { flag: 'a' })
        fs.writeFileSync(res["Cxa"], Cxa_str, { flag: 'a' })
        fs.writeFileSync(res["Cy"], Cy_str, { flag: 'a' })
        fs.writeFileSync(res["Cya"], Cya_str, { flag: 'a' })
        fs.writeFileSync(res["K"], K_str, { flag: 'a' })

    }


    const resultHeader = `Aerodynamic characteristics for ${vehicle_name}\nCalculated for specific area: ${area} m2\n\n\n\n`


    const machPoints = `Mach = \n ${MV.map(Mach => Mach.toFixed(2)).join('\t')}\n\n`

    const adxPrmPoints = `${adxPrms.map(({ reynolds, knudsen }) => 'Re: ' + reynolds + '; Kn: ' + knudsen).join('\t')}\n\n`

    console.log(resultHeader + machPoints + adxPrmPoints)

}

const processADX = function (geometry) {
    const { H, MV, AV, rad } = flight_parameters
    const { area } = vehicle_data

    activeAtmo.setupIndex(H)
    const test_flow = activeAtmo.getAtmo(H)

    const model = new AeroModel()

    model.init(geometry, area)
    console.log([
        'geometry ready',
        `length: ${model.size}`,
        `height: ${model.height}`,
        `width: ${model.width}`
    ].join('\n'))

    const { adxTable, adxParameters } = model.calcTable(
        MV,
        rad ? AV : AV.map(alpha => alpha * Math.PI / 180),
        0,
        test_flow
    )

    console.log('aerodinamic data ready to output;\n')

    prepareADXResult(adxTable, adxParameters, MV, AV, vehicle_data.vehicle_name, area, rad)
}

readSTL(vehicle_data, processADX)