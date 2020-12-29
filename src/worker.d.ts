declare module "worker-loader!./ImageWorker.ts" {
  class ImageWorker extends Worker {
    constructor();
  }

  export default ImageWorker;
}
