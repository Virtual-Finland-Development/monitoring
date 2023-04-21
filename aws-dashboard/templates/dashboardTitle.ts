export class DashboardTitle {
  public create(title: string, x: number, y: number) {
    return {
      type: "text",
      x: x,
      y: y,
      width: 15,
      height: 1,
      properties: {
        markdown: title,
        background: "transparent"
      }
    }
  }
}