import * as pulumi from '@pulumi/pulumi';
// import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

// const eip = new aws.ec2.Eip('satisfactory-eip', {
//   vpc: true,
// });

const sg = new awsx.ec2.SecurityGroup('satisfactory-security-group');
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-7777',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.TcpPorts(7777),
  'allow satisfactory 7777'
);
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-15000',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.TcpPorts(15000),
  'allow satisfactory 15000'
);
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-15777',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.TcpPorts(15777),
  'allow satisfactory 15777'
);
awsx.ec2.SecurityGroupRule.egress(
  'all',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.TcpPorts(0, 0),
  'allow all'
);

// const satServer = new awsx.ecs.EC2Service('satisfactory', {
//   cluster: satCluster,
//   taskDefinitionArgs: {
//     container: {
//       image: 'wolveix/satisfactory-server:latest',
//     },
//   },
// });

const cluster = new awsx.ecs.Cluster('satisfactory-cluster', { securityGroups: [sg] });

// still failing healthchecks; are these the problem???
const nlb = new awsx.lb.NetworkLoadBalancer('satisfactory-nlb', { external: true });
const listener7777 = nlb.createListener('satisfactory-7777', {
  port: 7777,
});
const listener15000 = nlb.createListener('satisfactory-15000', {
  port: 15000,
});
const listener15777 = nlb.createListener('satisfactory-15777', {
  port: 15777,
});

// Define the service, building and publishing our "./app/Dockerfile", and using the load balancer.
new awsx.ecs.FargateService('satisfactory', {
  cluster,
  desiredCount: 1,
  // loadBalancers: [nlb],
  taskDefinitionArgs: {
    containers: {
      satisfactory: {
        image: 'wolveix/satisfactory-server:latest',
        memory: 8192,
        // healthCheck: {
        //   startPeriod: 300,
        // },
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
// export const nlbstuff = nlb;
export const url1 = pulumi.interpolate`http://${listener7777.endpoint.hostname}/`;
export const url2 = pulumi.interpolate`http://${listener15000.endpoint.hostname}/`;
export const url3 = pulumi.interpolate`http://${listener15777.endpoint.hostname}/`;
