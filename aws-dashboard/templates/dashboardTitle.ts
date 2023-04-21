export enum DashboardTitleSize {
  'LARGE',
  'MEDIUM',
  'SMALL'
}

export class DashboardTitle {

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

    let formattedTitle = `${titleSize} ${title}`;

    return {
      type: "text",
      x: x,
      y: y,
      width: 15,
      height: 1,
      properties: {
        markdown: formattedTitle,
        background: "transparent"
      }
    }
  }
}