import * as pulumi from '@pulumi/pulumi';
// import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

// const eip = new aws.ec2.Eip('satisfactory-eip', {
//   vpc: true,
// });

// const satCluster = new awsx.ecs.Cluster('satisfactory-cluster');

// const satServer = new awsx.ecs.EC2Service('satisfactory', {
//   cluster: satCluster,
//   taskDefinitionArgs: {
//     container: {
//       image: 'wolveix/satisfactory-server:latest',
//     },
//   },
// });

const listener7777 = new awsx.elasticloadbalancingv2.NetworkListener('satisfactory-7777', {
  port: 7777,
});
const listener15000 = new awsx.elasticloadbalancingv2.NetworkListener('satisfactory-15000', {
  port: 15000,
});
const listener15777 = new awsx.elasticloadbalancingv2.NetworkListener('satisfactory-15777', {
  port: 15777,
});

// Define the service, building and publishing our "./app/Dockerfile", and using the load balancer.
const service = new awsx.ecs.FargateService('satisfactory', {
  desiredCount: 1,
  taskDefinitionArgs: {
    containers: {
      satisfactory: {
        image: 'wolveix/satisfactory-server:latest',
        memory: 8192,
        healthCheck: {
          command: ['ps aux | grep satisfactory'],
        },
        environment: [
          { name: 'STEAMUSER', value: 'anonymous' },
          { name: 'STEAMBETA', value: 'false' },
          { name: 'MAXBACKUPS', value: '10' },
        ],
        portMappings: [listener7777, listener15000, listener15777],
      },
    },
  },
});

// Export the URL so we can easily access it.
export const fargateService = service;
export const satisfactoryURL = pulumi.interpolate`http://${listener7777.endpoint.hostname}/`;
