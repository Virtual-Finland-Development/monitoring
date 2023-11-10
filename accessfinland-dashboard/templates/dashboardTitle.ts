export enum DashboardTitleSize {
  'LARGE',
  'MEDIUM',
  'SMALL'
}

export class DashboardTitle {
  private _body: string = '';
  private _bodyHeight: number = 1;

  public create(title: string, x: number, y: number, desiredTitleSize: DashboardTitleSize = DashboardTitleSize.LARGE) {

    let titleSize: string;

    switch (desiredTitleSize) {
      case DashboardTitleSize.LARGE:
        titleSize = "#";
        break;
      case DashboardTitleSize.MEDIUM:
        titleSize = "##";
        break;
      case DashboardTitleSize.SMALL:
        titleSize = "###";
        break;
    }

    let formattedTitle = `${titleSize} ${title}\n${this._body}`;

    return {
      type: "text",
      x: x,
      y: y,
      width: 15,
      height: this._bodyHeight,
      properties: {
        markdown: formattedTitle,
        background: "transparent"
      }
    }
  }

  withBody(body: string) {
    this._bodyHeight = 2;
    this._body = body;
    return this;
  }
}