import sys
from flyplot.flyplot import PlotWindow
from PySide6 import QtWidgets

if __name__ == '__main__':

    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication(sys.argv)
    w = PlotWindow(chart_type="2D")
    w.show()
    sys.exit(app.exec())