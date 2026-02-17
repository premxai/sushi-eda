declare module "react-plotly.js" {
  import { Component } from "react";
  import Plotly from "plotly.js";

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    frames?: Plotly.Frame[];
    revision?: number;
    onInitialized?: (figure: Readonly<PlotParams>, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: Readonly<PlotParams>, graphDiv: HTMLElement) => void;
    onPurge?: (figure: Readonly<PlotParams>, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    useResizeHandler?: boolean;
    style?: React.CSSProperties;
    className?: string;
    divId?: string;
    onClick?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
    onHover?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
    onUnhover?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
    onSelected?: (event: Readonly<Plotly.PlotSelectionEvent>) => void;
  }

  export default class Plot extends Component<PlotParams> {}
}
