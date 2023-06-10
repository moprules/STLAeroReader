const GasDynamics = require('./gasDynamics.js')
const Vector = require('./vectorOps.js')
class AeroModel {
    constructor() {
        this.area = 0       // Характерная площадь
        this.nFacets = 0    // количество элементарных фасеток
        this.facets = []    // Массив фасеток, составляющих геометрию объекта
        this.sWetted = 0    // Площадь смачиваемой поверхности
        this.size = 0       // Длина
        this.width = 0
        this.height = 0
        // Центр поверхности аппарата
        this.Xcs = 0
        this.Ycs = 0
    }
    /**
     * @description получить исходные данные, на их основе определить смачиваемую поверхность конуса
     * @param {Array.<Object>} facets массив точек, формирующих контур ЛА
     * @param {Number} area характерная площадь ЛА
     * @return {void}
     */
    init(facets, area) {
        this.area = area
        this.facets = facets
        this.nFacets = this.facets.length

        let xMin = 0
        let xMax = 0
        let yMin = 0
        let yMax = 0
        let zMin = 0
        let zMax = 0

        let pp1 = [0, 0, 0]
        let pp2 = [0, 0, 0]
        let pp3 = [0, 0, 0]

        let centerSurface = [0, 0, 0]
        let surfaceProex = [0, 0, 0]
        let proexArea = 0
        for (let i = 0; i < this.nFacets; i++) {
            let { p1, p2, p3 } = this.facets[i]

            let localCenter = Vector.triCenter(p1, p2, p3)
            for (let k = 0; k < 3; k++) {
                pp1 = [...p1]
                pp2 = [...p2]
                pp3 = [...p3]
                pp1[k] = 0
                pp2[k] = 0
                pp3[k] = 0

                let isCan = true
                for (let n = 0; n < 3; n++) {
                    if (n != k) {
                        if (pp1[n] == pp2[n] ||
                            pp1[n] == pp3[n] ||
                            pp2[n] == pp3[n]) {
                            isCan = false
                            break
                        }
                    }
                }
                if (isCan) {
                    proexArea = Vector.heronArea(pp1, pp2, pp3)
                    centerSurface[k] += proexArea * localCenter[k]
                    surfaceProex[k] += proexArea
                }
            }
            this.sWetted += Vector.heronArea(p1, p2, p3)

            xMin = Math.min(xMin, p1[0], p2[0], p3[0])
            xMax = Math.max(xMax, p1[0], p2[0], p3[0])
            yMin = Math.min(yMin, p1[1], p2[1], p3[1])
            yMax = Math.max(yMax, p1[1], p2[1], p3[1])
            zMin = Math.min(zMin, p1[2], p2[2], p3[2])
            zMax = Math.max(zMax, p1[2], p2[2], p3[2])
        }

        this.size = xMax - xMin
        this.height = yMax - yMin
        this.width = zMax - zMin

        for (let k = 0; k < 3; k++) {
            if (surfaceProex[k] == 0) {
                centerSurface[k] = 0
            } else {
                centerSurface[k] /= surfaceProex[k]
            }
        }

        this.Xcs = this.size - centerSurface[0]
        this.Ycs = centerSurface[2]
    }

    /**
     * @description получить параметры обтекания элементарной объекта при одном значении числа M, угла атаки и скольжения
     * @param {Number} Qpress скоростной напор
     * @param {Number} ThMax максимальный угол присоединенного скачка
     * @param {Number} NuMax максимальный местный угол клина
     * @param {Number} Mach число M
     * @param {Object} flow поток (давление, плотность, температура, скорость звука, постоянная адиабаты, газовая постоянная)
     * @param {Number} alpha угол атаки
     * @param {Number} betha угол скольжения
     * @return {Object} параметры обтекания
     */
    calcSinglePoint(Qpress, ThMax, NuMax, Mach, flow, alpha, betha, Kn = 0, CxF) {
        const { P, k, aSn, vChaotic } = flow

        const QS = Qpress * this.area

        const CTA = Math.cos(alpha)
        const STA = Math.sin(alpha)
        const CTB = Math.cos(betha)
        const STB = Math.sin(betha)

        const Velocity = [
            CTA * CTB,
            -STA,
            CTA * STB
        ]

        const adxSumm = [0, 0, 0]
        const torqueSumm = [0, 0, 0]
        const PI_05 = Math.PI * 0.5

        for (let i = 0; i < this.nFacets; i++) {
            const { norm, p1, p2, p3 } = this.facets[i]
            const localNu0 = Vector.angleBetween(Velocity, norm)
            const localNu = Math.abs(localNu0) > PI_05 ?
                -Math.abs(localNu0) + PI_05 :
                PI_05 - Math.abs(localNu0)

            const localArea = Vector.heronArea(p1, p2, p3)
            const localCenter = Vector.triCenter(p1, p2, p3)

            let deltaP = 1
            if (Kn < 1E-2) {
                deltaP = GasDynamics.getDeltaPressure(ThMax, NuMax, localNu, Mach, k)
            } else if (Kn >= 1E-2 && Kn < 10) {
                const k_rare = (2.3026 - Math.log(Kn)) / 6.908
                deltaP = k_rare * GasDynamics.getDeltaPressure(ThMax, NuMax, localNu, Mach, k) + (1 - k_rare) * GasDynamics.getSlipFlow(localNu, Mach, k, aSn, vChaotic)
            } else if (Kn >= 10) {
                deltaP = GasDynamics.getSlipFlow(localNu, Mach, k, aSn, vChaotic)
            }

            const localForce = deltaP * P * localArea

            const dX = -localForce * norm[0]
            const dY = -localForce * norm[1]
            const dZ = -localForce * norm[2]

            adxSumm[0] += dX
            adxSumm[1] += dY
            adxSumm[2] += dZ

            torqueSumm[0] += (dY * localCenter[2] + dZ * localCenter[1])
            torqueSumm[1] += (dX * localCenter[2] + dZ * localCenter[0])
            torqueSumm[2] += (dX * localCenter[1] + dY * localCenter[0])
        }

        let Fx = -adxSumm[0] // сопротивление
        let Fy = adxSumm[1] // подъемная сила
        let Fz = adxSumm[2] // боковая сила
        let Cx = -adxSumm[0] / QS // коэф.сопротивления
        let Cy = adxSumm[1] / QS // коэф.подъемной силы
        let Cz = adxSumm[2] / QS // коэф. боковой силы
        let Cxa = Cx * CTA + Cy * STA + CxF
        let Cya = Cy * CTA - Cx * STA
        let K = Cya / Cxa
        let Mx = torqueSumm[0]
        let My = torqueSumm[1]
        let Mz = torqueSumm[2]

        return { Fx, Fy, Fz, Cx, Cy, Cz, Cxa, Cya, K, Mx, My, Mz }
    }
    /**
     * @description получить таблицу АДХ для заданного диапазона чисел M и углов атаки
     * @param {Array.<Number>} MV узловые точки по числам M
     * @param {Array.Number} AV узловые точки по углам атаки
     * @param {Number} betha угол скольжения
     * @param {Object} flow параметры невозмущенного потока (см.предыдущий метод)
     * @returns {Array.<Object>} таблица АДХ-коэффициентов
     */
    calcTable(MV, AV, betha, flow) {
        const nMach = MV.length
        const nAlpha = AV.length
        const { P, k, aSn } = flow
        const result = new Array(nMach)
        const adxParameters = []

        for (let i = 0; i < nMach; i++) {
            result[i] = []
            const Mach = MV[i]
            const reynolds = Mach * aSn * this.size / flow.viscosity
            const knudsen = Mach * Math.sqrt(0.5 * k * Math.PI) / reynolds
            const CxF = 0.074 * Math.pow(reynolds, -0.2) * this.sWetted / this.area
            const Qpress = 0.5 * k * P * Mach * Mach
            const { NuMax, ThMax } = GasDynamics.getThMax(Mach, k)

            adxParameters.push({ reynolds, knudsen })
            // Шаг для определеняи центра давления 5 градусов
            const delta = 10 * Math.PI / 180
            for (let j = 0; j < nAlpha; j++) {
                const alpha = AV[j]

                let curPoint = this.calcSinglePoint(Qpress, ThMax, NuMax, Mach, flow, alpha, betha, knudsen, CxF)
                let deltaPoint = this.calcSinglePoint(Qpress, ThMax, NuMax, Mach, flow, alpha + delta, betha, knudsen, CxF)
                // Определяем центр давления
                const M = [[curPoint.Fy, curPoint.Fx], [deltaPoint.Fy, deltaPoint.Fx]]
                const b = [curPoint.Mz, deltaPoint.Mz]

                let Cd = Vector.solve(M, b)

                const adxMachAlpha = {
                    ...curPoint,
                    CxF,
                    Xcd: this.size - Cd[0],
                    Ycd: Cd[1]
                }
                result[i].push(adxMachAlpha)
            }
        }

        return { adxTable: result, adxParameters }
    }
}

module.exports = AeroModel